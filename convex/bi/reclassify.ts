/**
 * Saneo de taxonomía del histórico del Sheet (cierra los `viatico_review`).
 *
 * La carga F1 dejó 40 issues `viatico_review` pidiendo revisar la taxonomía de
 * payroll 2026. Al revisarlos uno por uno (QA-2) salieron dos mapeos malos y un
 * resto correcto:
 *
 *  1. **COMISIONES → `salario`** (7 filas, ₡303.427). La comisión es costo
 *     variable atado a la venta, no payroll. Con la auto-captura (F5-auto)
 *     además va a llegar sola en cada inspección, así que necesita su propia
 *     categoría o queda mezclada con los sueldos.
 *  2. **IMPUESTOS → `otros`** (6 filas) — este es el que importa: al quedar en
 *     `otros`, la regla B22 no las alcanzaba (`FORCE_NON_VIATICO` mira la
 *     categoría), y **4 de ellas quedaron marcadas como viático**: ₡834.990 de
 *     los ₡3.202.985 de "viáticos" eran en realidad impuestos. La regla estaba
 *     bien; el mapeo de la etiqueta era el que fallaba.
 *  3. El resto (provisiones de aguinaldo/cesantía/vacaciones/preaviso/despido,
 *     aporte patronal CCSS, póliza INS) **está bien categorizado**: son payroll
 *     y ya tienen `isViatico=false`. Se marcan como revisados.
 *
 * No mueve la utilidad ni el gasto total: solo corrige el desglose por
 * categoría y el flag de viático. Idempotente, y con `dryRun` para poder ver el
 * efecto en PROD antes de aplicarlo.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { enforceViatico } from "./lib/financeRules";

/** Etiqueta del Sheet dentro de `externalKey` ("sheet:<mes>:<ETIQUETA>:<n>"). */
function sheetLabel(externalKey: string | undefined): string {
  return (externalKey ?? "").split(":")[2]?.toUpperCase() ?? "";
}

/** Mapeo a corregir: etiqueta del Sheet → categoría correcta. */
const RECLASS: ReadonlyArray<{ label: string; from: string; to: string }> = [
  { label: "COMISIONES", from: "salario", to: "comision" },
  { label: "IMPUESTOS", from: "otros", to: "impuestos" },
];

export const fixSheetTaxonomy = internalMutation({
  args: { dryRun: v.optional(v.boolean()), runId: v.optional(v.string()) },
  returns: v.object({
    dryRun: v.boolean(),
    reclasificadas: v.array(
      v.object({
        externalKey: v.string(),
        de: v.string(),
        a: v.string(),
        viaticoAntes: v.boolean(),
        viaticoDespues: v.boolean(),
        amountCRC: v.number(),
      }),
    ),
    viaticosCorregidos: v.number(),
    viaticoMontoLiberado: v.number(),
    issuesResueltos: v.number(),
  }),
  handler: async (ctx, { dryRun, runId }) => {
    const isDry = dryRun !== false; // seguro por defecto: hay que pedir aplicar
    const rows = await ctx.db.query("finance_entries").collect();

    const reclasificadas: {
      externalKey: string;
      de: string;
      a: string;
      viaticoAntes: boolean;
      viaticoDespues: boolean;
      amountCRC: number;
    }[] = [];
    let viaticosCorregidos = 0;
    let viaticoMontoLiberado = 0;

    for (const r of rows) {
      const label = sheetLabel(r.externalKey);
      const rule = RECLASS.find((m) => m.label === label && r.category === m.from);
      if (!rule) continue;

      // La regla de viático se re-aplica con la categoría NUEVA (A39: una sola
      // fuente de verdad; no se decide acá qué es viático).
      const { isViatico } = enforceViatico(rule.to, r.isViatico);

      reclasificadas.push({
        externalKey: r.externalKey ?? "",
        de: r.category,
        a: rule.to,
        viaticoAntes: r.isViatico,
        viaticoDespues: isViatico,
        amountCRC: r.amountCRC,
      });
      if (r.isViatico && !isViatico) {
        viaticosCorregidos++;
        viaticoMontoLiberado += r.amountCRC;
      }

      if (!isDry) {
        await ctx.db.patch(r._id, {
          category: rule.to,
          isViatico,
          updatedAt: Date.now(),
        });
      }
    }

    // Los 40 issues quedan revisados: 13 filas corregidas arriba y el resto
    // confirmado como payroll bien categorizado. Se marcan resueltos, no se
    // borran (AGENTS §3: el log de calidad no se limpia en silencio).
    const issues = (
      await ctx.db
        .query("bi_quality_issues")
        .withIndex("by_type", (q) => q.eq("issueType", "viatico_review"))
        .collect()
    ).filter((i) => !i.resolved);

    if (!isDry) {
      const rid = runId ?? "qa2-taxonomia";
      for (const i of issues) {
        await ctx.db.patch(i._id, {
          resolved: true,
          detail: `${i.detail ?? ""} — revisado QA-2 (${rid}): B22 aplicada; COMISIONES→comision, IMPUESTOS→impuestos, provisiones/CCSS/póliza confirmadas como payroll`,
        });
      }
    }

    return {
      dryRun: isDry,
      reclasificadas,
      viaticosCorregidos,
      viaticoMontoLiberado,
      issuesResueltos: issues.length,
    };
  },
});
