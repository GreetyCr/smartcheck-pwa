/**
 * F5 · F6 — Captura manual de finanzas (formulario del dashboard).
 *
 * Mutations/queries PÚBLICAS con `requireAdmin` para que Esteban registre
 * ingresos/gastos/viáticos desde el panel → **retira el Google Sheet**. Comparte
 * las reglas de negocio con el loader de migración vía `lib/financeRules` (A39):
 * allow-list de categorías (RF-11), forzado de viático (B22) y FX en USD. A
 * diferencia del loader (que registra `bi_quality_issues` y sigue), el formulario
 * es interactivo → **valida rechazando** (lanza error claro) antes de escribir.
 *
 * SOLO escritura sobre `finance_entries` con `source:"manual"`. Nunca hard-delete
 * (soft-delete con `isDeleted`). No toca `externalKey` (idempotencia del Sheet).
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { crMidnightMs, yearMonth } from "./lib/dates";
import {
  enforceViatico,
  isCategoryAllowed,
  isFxMissing,
  isSystemGenerated,
  type Currency,
  type FinanceKind,
} from "./lib/financeRules";

/* -------------------------------------------------------------------------- */
/* Args editables (compartidos por create/update)                             */
/* -------------------------------------------------------------------------- */

const editableArgs = {
  kind: v.union(v.literal("income"), v.literal("expense")),
  category: v.string(),
  originalAmount: v.number(), // monto en la moneda original (> 0)
  originalCurrency: v.union(v.literal("CRC"), v.literal("USD")),
  fxRate: v.optional(v.number()), // ₡/US$ — obligatorio si USD
  date: v.string(), // "YYYY-MM-DD" (día de negocio, zona CR)
  isViatico: v.boolean(),
  note: v.optional(v.string()),
  tecnico: v.optional(v.string()), // viático (RF-19)
  localidad: v.optional(v.string()),
};

type EditableInput = {
  kind: FinanceKind;
  category: string;
  originalAmount: number;
  originalCurrency: Currency;
  fxRate?: number;
  date: string;
  isViatico: boolean;
  note?: string;
  tecnico?: string;
  localidad?: string;
};

/**
 * Valida (lanzando) y normaliza una entrada del formulario a los campos
 * persistidos de `finance_entries`. Misma semántica que el loader (reglas en
 * lib), pero aquí un dato inválido **rechaza** en vez de cargar con warning.
 */
function normalizeEntry(input: EditableInput) {
  if (!Number.isFinite(input.originalAmount) || input.originalAmount <= 0) {
    throw new Error("El monto debe ser un número mayor a 0.");
  }
  if (!isCategoryAllowed(input.kind, input.category)) {
    const tipo = input.kind === "income" ? "ingreso" : "gasto";
    throw new Error(`Categoría inválida para ${tipo}: "${input.category}".`);
  }
  if (isFxMissing(input.originalCurrency, input.fxRate)) {
    throw new Error(
      "Un movimiento en USD requiere el tipo de cambio (fxRate).",
    );
  }

  let fxRate: number | undefined;
  let amountCRC: number;
  if (input.originalCurrency === "USD") {
    if (!Number.isFinite(input.fxRate) || (input.fxRate ?? 0) <= 0) {
      throw new Error("El tipo de cambio (fxRate) debe ser mayor a 0.");
    }
    fxRate = input.fxRate;
    amountCRC = Math.round(input.originalAmount * (input.fxRate as number));
  } else {
    fxRate = undefined; // CRC no usa fxRate
    amountCRC = Math.round(input.originalAmount);
  }

  const dateMs = crMidnightMs(input.date); // lanza si la fecha es inválida
  const ym = yearMonth(dateMs);
  const isViatico = enforceViatico(input.category, input.isViatico).isViatico;

  return {
    kind: input.kind,
    category: input.category,
    isViatico,
    amountCRC,
    originalAmount: input.originalAmount,
    originalCurrency: input.originalCurrency,
    fxRate,
    date: dateMs,
    yearMonth: ym,
    note: input.note,
    tecnico: input.tecnico,
    localidad: input.localidad,
  };
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

/** Alta de ingreso/gasto/viático manual (RF-14). */
export const createFinanceEntry = mutation({
  args: editableArgs,
  returns: v.object({ id: v.id("finance_entries") }),
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);
    const now = Date.now();
    const fields = normalizeEntry(args);
    const id = await ctx.db.insert("finance_entries", {
      ...fields,
      source: "manual",
      createdBy: user.clerkId,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },
});

/**
 * Edición de una entrada. Re-valida y recalcula igual que el alta. NUNCA toca
 * `externalKey`/`source`/`createdBy`/`createdAt`. Un `patch` con un opcional en
 * `undefined` (p. ej. `fxRate` al pasar de USD a CRC) borra ese campo — deseado.
 */
export const updateFinanceEntry = mutation({
  args: { id: v.id("finance_entries"), ...editableArgs },
  returns: v.object({ id: v.id("finance_entries") }),
  handler: async (ctx, { id, ...rest }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.isDeleted) {
      throw new Error("Entrada no encontrada o eliminada.");
    }
    if (isSystemGenerated(existing.source)) {
      throw new Error(
        "Este movimiento lo genera el sistema al entregar el reporte. " +
          "Para corregirlo, ajustá el monto cobrado en la inspección.",
      );
    }
    const fields = normalizeEntry(rest);
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
    return { id };
  },
});

/** Borrado SUAVE (nunca hard-delete): marca `isDeleted`. */
export const deleteFinanceEntry = mutation({
  args: { id: v.id("finance_entries") },
  returns: v.object({ id: v.id("finance_entries") }),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Entrada no encontrada.");
    if (existing.isDeleted) return { id }; // idempotente
    if (isSystemGenerated(existing.source)) {
      throw new Error(
        "Este movimiento lo genera el sistema al entregar el reporte y no se " +
          "puede eliminar a mano.",
      );
    }
    await ctx.db.patch(id, { isDeleted: true, updatedAt: Date.now() });
    return { id };
  },
});

/* -------------------------------------------------------------------------- */
/* Query de listado (para la tabla/edición del formulario)                    */
/* -------------------------------------------------------------------------- */

/** Entradas no borradas, recientes primero. Filtra por mes y/o tipo. */
export const listFinanceEntries = query({
  args: {
    yearMonth: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("income"), v.literal("expense"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("finance_entries"),
      kind: v.union(v.literal("income"), v.literal("expense")),
      category: v.string(),
      amountCRC: v.number(),
      originalAmount: v.optional(v.number()),
      originalCurrency: v.union(v.literal("CRC"), v.literal("USD")),
      fxRate: v.optional(v.number()),
      date: v.number(),
      yearMonth: v.string(),
      isViatico: v.boolean(),
      note: v.optional(v.string()),
      tecnico: v.optional(v.string()),
      localidad: v.optional(v.string()),
      source: v.union(
        v.literal("sheet"),
        v.literal("manual"),
        v.literal("inspection"),
      ),
      // La regla vive en el backend: el cliente no decide qué se puede tocar.
      editable: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { yearMonth: ym, kind, limit }) => {
    await requireAdmin(ctx);
    const cap = limit ?? 100;
    const rows = ym
      ? await ctx.db
          .query("finance_entries")
          .withIndex("by_year_month", (q) => q.eq("yearMonth", ym))
          .collect()
      : await ctx.db.query("finance_entries").collect();

    return rows
      .filter((r) => !r.isDeleted && (!kind || r.kind === kind))
      .sort((a, b) => b.date - a.date)
      .slice(0, cap)
      .map((r) => ({
        id: r._id,
        kind: r.kind,
        category: r.category,
        amountCRC: r.amountCRC,
        originalAmount: r.originalAmount,
        originalCurrency: r.originalCurrency,
        fxRate: r.fxRate,
        date: r.date,
        yearMonth: r.yearMonth,
        isViatico: r.isViatico,
        note: r.note,
        tecnico: r.tecnico,
        localidad: r.localidad,
        source: r.source,
        editable: !isSystemGenerated(r.source),
        createdAt: r.createdAt,
      }));
  },
});
