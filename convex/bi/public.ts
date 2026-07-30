/**
 * Superficie de LECTURA pública del BI para el dashboard (A40 · A41).
 *
 * Cada query gatea con `requireAdmin`; las funciones de cómputo del BI siguen
 * siendo `internal` (blindaje A23). Como en Convex una `query` no puede
 * `ctx.runQuery`, estos wrappers reutilizan los **helpers puros** exportados por
 * las internalQuery (p. ej. `computeFinanceSummary`), no las funciones Convex.
 *
 * Finanzas-first: por ahora solo se expone la lectura de finanzas. El resto de
 * tableros (resumen ejecutivo, conversión, calidad) se agregan igual, después.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { computeFinanceSummary, financeSummaryReturns } from "./metrics";

/**
 * Resumen financiero para el tab de Finanzas: serie mensual
 * (ingresos/gastos/utilidad/margen) + totales + viáticos. Mismos números que la
 * `internalQuery` `bi/metrics:financeSummary` (comparten cómputo). Opcionalmente
 * acotable por rango `[fromMs, toMs)`.
 */
export const financeSummary = query({
  args: { fromMs: v.optional(v.number()), toMs: v.optional(v.number()) },
  returns: financeSummaryReturns,
  handler: async (ctx, { fromMs, toMs }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("finance_entries").collect();
    return computeFinanceSummary(rows, fromMs, toMs);
  },
});
