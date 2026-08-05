/**
 * F5-auto — el cobro de la inspección entra solo a finanzas.
 *
 * Cuando el reporte se marca como entregado, el sistema deriva de la inspección
 * las filas de `finance_entries` correspondientes, para que Esteban no tenga que
 * re-digitar en el formulario un monto que la app ya conoce.
 *
 * Reglas de negocio (confirmadas por Esteban el 5-ago-2026):
 *  - **El reporte solo se marca entregado cuando el cliente ya pagó la
 *    totalidad** → `reportDeliveredAt` es una fecha de ingreso legítima, no una
 *    promesa de cobro.
 *  - `totalAmountCharged` es **bruto**: la comisión NO viene restada, y el
 *    adicional fuera del GAM ya va incluido en ese total de ahora en adelante.
 *  - Montos ≤ ₡1.000 son placeholders del histórico (B15) → no generan ingreso.
 *
 * Por qué dos asientos y no uno neteado: la conciliación compara el lado
 * finanzas contra `totalAmountCharged`. Si guardáramos el neto, todos los meses
 * mostrarían un gap artificial. Ver `splitInspectionCharge` en `lib/financeRules`.
 *
 * **Idempotente y re-derivable**: la llave es `externalKey`
 * (`inspection:<id>:income` / `:comision`), así que correrlo n veces deja el
 * mismo estado, y si el monto de la inspección se corrige después, la fila se
 * actualiza. Por eso estas filas no se editan a mano (ver `financeForm`).
 *
 * SOLO escribe en `finance_entries` y `bi_quality_issues`. **Nunca** toca
 * `inspections` (A23: la operativa es de solo lectura para el BI).
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { crMidnightMs, isoDate } from "./lib/dates";
import {
  isPlaceholderCharge,
  splitInspectionCharge,
} from "./lib/financeRules";

const RUN_ID = "f5-auto";

/** Resultado por inspección: qué se hizo con cada asiento. */
type Outcome = "inserted" | "updated" | "retired" | "skipped" | "none";

const outcome = v.union(
  v.literal("inserted"),
  v.literal("updated"),
  v.literal("retired"),
  v.literal("skipped"),
  v.literal("none"),
);

/** Nota legible del movimiento: qué carro y de quién. */
function buildNote(insp: Doc<"inspections">): string {
  const vehicle = [insp.vehicleBrand, insp.vehicleModel, insp.vehicleYear]
    .filter(Boolean)
    .join(" ")
    .trim();
  return [vehicle || null, insp.clientName || null]
    .filter(Boolean)
    .join(" — ");
}

/**
 * Deja una fila en el estado que dicta la inspección. Devuelve qué pasó.
 *
 * `amount === null` significa "este asiento no corresponde" (p. ej. la
 * inspección no lleva comisión): si existía, se retira con borrado SUAVE —
 * nunca se borra de verdad, para que el movimiento retirado siga auditable.
 */
async function upsertEntry(
  ctx: MutationCtx,
  input: {
    externalKey: string;
    amount: number | null;
    kind: "income" | "expense";
    category: string;
    date: number;
    yearMonth: string;
    note: string;
    inspectionId: Id<"inspections">;
  },
): Promise<Outcome> {
  const existing = await ctx.db
    .query("finance_entries")
    .withIndex("by_external_key", (q) => q.eq("externalKey", input.externalKey))
    .first();

  const now = Date.now();

  if (input.amount === null) {
    if (!existing || existing.isDeleted) return "none";
    await ctx.db.patch(existing._id, { isDeleted: true, updatedAt: now });
    return "retired";
  }

  const fields = {
    kind: input.kind,
    category: input.category,
    isViatico: false,
    amountCRC: input.amount,
    originalAmount: input.amount,
    originalCurrency: "CRC" as const,
    date: input.date,
    yearMonth: input.yearMonth,
    source: "inspection" as const,
    externalKey: input.externalKey,
    note: input.note,
    linkedInspectionId: input.inspectionId,
    isDeleted: false,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return "updated";
  }

  await ctx.db.insert("finance_entries", { ...fields, createdAt: now });
  return "inserted";
}

/** Registra el issue una sola vez por inspección (no acumula en cada corrida). */
async function noteIssue(
  ctx: MutationCtx,
  entityRef: string,
  detail: string,
): Promise<void> {
  const already = await ctx.db
    .query("bi_quality_issues")
    .withIndex("by_type", (q) => q.eq("issueType", "zero_revenue"))
    .filter((q) => q.eq(q.field("entityRef"), entityRef))
    .first();
  if (already) return;

  await ctx.db.insert("bi_quality_issues", {
    issueType: "zero_revenue",
    severity: "warn",
    entity: "finance_entries",
    entityRef,
    detail,
    runId: RUN_ID,
    detectedAt: Date.now(),
    resolved: false,
  });
}

/**
 * Sincroniza las finanzas de UNA inspección con lo que dice la inspección hoy.
 *
 * La llama el scheduler desde `markReportDelivered` (fuera de la transacción de
 * la entrega, para que un fallo acá no tumbe la entrega del reporte). Se puede
 * volver a llamar sin miedo: es idempotente.
 */
export const syncFromInspection = internalMutation({
  args: { inspectionId: v.id("inspections") },
  returns: v.object({
    ok: v.boolean(),
    reason: v.optional(v.string()),
    income: outcome,
    comision: outcome,
  }),
  handler: async (ctx, { inspectionId }) => {
    const skip = (reason: string) => ({
      ok: false,
      reason,
      income: "skipped" as const,
      comision: "skipped" as const,
    });

    const insp = await ctx.db.get(inspectionId);
    if (!insp) return skip("inspeccion_inexistente");

    // Solo el reporte entregado implica cobrado (regla de Esteban). Si la
    // inspección vuelve atrás, retiramos lo que hubiéramos creado.
    const delivered = insp.status === "report_delivered";
    const amount = insp.totalAmountCharged;

    const ref = `inspection:${inspectionId}`;
    const keyIncome = `${ref}:income`;
    const keyComision = `${ref}:comision`;

    if (!delivered) {
      const income = await retire(ctx, keyIncome);
      const comision = await retire(ctx, keyComision);
      return { ok: true, reason: "no_entregado", income, comision };
    }

    if (isPlaceholderCharge(amount)) {
      await noteIssue(
        ctx,
        ref,
        `reporte entregado con monto ${amount ?? "ausente"} (≤ ₡1.000, B15): no se generó ingreso automático`,
      );
      const income = await retire(ctx, keyIncome);
      const comision = await retire(ctx, keyComision);
      return { ok: true, reason: "monto_placeholder", income, comision };
    }

    const { income: incomeAmount, commission } = splitInspectionCharge({
      totalAmountCharged: amount as number,
      commissionFeeAmount: insp.commissionFeeAmount,
    });

    // Día de negocio en zona CR, igual que la captura manual (F5): así las dos
    // vías caen en el mismo día y el mismo `yearMonth`.
    const deliveredAt = insp.reportDeliveredAt ?? Date.now();
    const date = crMidnightMs(isoDate(deliveredAt));
    const ym = isoDate(deliveredAt).slice(0, 7);
    const note = buildNote(insp);

    const incomeOutcome = await upsertEntry(ctx, {
      externalKey: keyIncome,
      amount: incomeAmount,
      kind: "income",
      category: "inspeccion",
      date,
      yearMonth: ym,
      note,
      inspectionId,
    });

    const comisionOutcome = await upsertEntry(ctx, {
      externalKey: keyComision,
      amount: commission,
      kind: "expense",
      category: "comision",
      date,
      yearMonth: ym,
      note: note ? `Comisión — ${note}` : "Comisión de venta",
      inspectionId,
    });

    return {
      ok: true,
      reason: undefined,
      income: incomeOutcome,
      comision: comisionOutcome,
    };
  },
});

/** Borrado suave de un asiento que dejó de corresponder. */
async function retire(ctx: MutationCtx, externalKey: string): Promise<Outcome> {
  const existing = await ctx.db
    .query("finance_entries")
    .withIndex("by_external_key", (q) => q.eq("externalKey", externalKey))
    .first();
  if (!existing || existing.isDeleted) return "none";
  await ctx.db.patch(existing._id, { isDeleted: true, updatedAt: Date.now() });
  return "retired";
}
