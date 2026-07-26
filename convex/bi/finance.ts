/**
 * F1 · WP-4 — Carga idempotente del histórico financiero (Sheet) en `finance_entries`.
 *
 * Patrón (AGENTS §7.6, MODELO-DATOS §1.2/§6): `internalMutation` por lotes, upsert
 * idempotente por `externalKey` (`withIndex("by_external_key").unique()` → patch/insert),
 * con try/catch por fila (fila mala → `bi_quality_issues`, nunca aborta el lote).
 *
 * Fuente del dataset: `SmartCheck-BI-Proyecto/docs/handoffs/F1-WP3-mapped.json` (505 filas,
 * preview mapeado de WP-3). El driver de carga lo trocea y llama `loadFinanceBatch`.
 *
 * SOLO DEV en este WP. La migración a PROD es WP-5 (gated).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { yearMonth as ymFromMs } from "./lib/dates";

/* -------------------------------------------------------------------------- */
/* Reglas de negocio                                                          */
/* -------------------------------------------------------------------------- */

/**
 * B22 — payroll / impuestos / gastos fijos NO son viáticos. Se fuerza
 * `isViatico=false` para estas categorías. Solo `comida`/`gasolina`/`bonos`
 * (y `otros` variable marcado en WP-3) son gastos variables/viáticos.
 */
const FORCE_NON_VIATICO = new Set([
  "salario",
  "impuestos",
  "seguro",
  "mantenimiento",
  "publicidad",
  "otros-fijo",
]);

/** Allow-list de categorías (RF-11). Fuera de lista → issue `unmapped_category` (warn), pero se carga. */
const INCOME_CATS = new Set(["inspeccion", "adicional_gasolina", "otros"]);
const EXPENSE_CATS = new Set([
  "comida",
  "gasolina",
  "bonos",
  "otros",
  "salario",
  "mantenimiento",
  "publicidad",
  "seguro",
  "impuestos",
]);

/** Zona CR (UTC-6 fijo, sin DST): medianoche local del día de negocio → epoch ms. */
function crMidnightMs(isoDay: string): number {
  const ms = Date.parse(`${isoDay}T00:00:00-06:00`);
  if (Number.isNaN(ms)) throw new Error(`fecha inválida: "${isoDay}"`);
  return ms;
}

/* -------------------------------------------------------------------------- */
/* Validadores                                                                */
/* -------------------------------------------------------------------------- */

const rawEntry = v.object({
  kind: v.union(v.literal("income"), v.literal("expense")),
  category: v.string(),
  isViatico: v.boolean(),
  amountCRC: v.number(),
  originalAmount: v.optional(v.union(v.number(), v.null())),
  originalCurrency: v.union(v.literal("CRC"), v.literal("USD")),
  fxRate: v.optional(v.union(v.number(), v.null())),
  date: v.string(), // "YYYY-MM-DD" — se convierte a epoch ms CR
  yearMonth: v.string(),
  externalKey: v.string(),
  note: v.optional(v.string()),
  source: v.union(v.literal("sheet"), v.literal("manual")),
});

const batchResult = v.object({
  received: v.number(),
  inserted: v.number(),
  patched: v.number(),
  failed: v.number(),
  viaticoForced: v.number(),
  unmappedCategory: v.number(),
  fxMissing: v.number(),
  viaticoReview: v.number(),
});

/* -------------------------------------------------------------------------- */
/* Carga idempotente por lotes                                                */
/* -------------------------------------------------------------------------- */

export const loadFinanceBatch = internalMutation({
  args: { entries: v.array(rawEntry), runId: v.string() },
  returns: batchResult,
  handler: async (ctx, { entries, runId }) => {
    const now = Date.now();
    let inserted = 0;
    let patched = 0;
    let failed = 0;
    let viaticoForced = 0;
    let unmappedCategory = 0;
    let fxMissing = 0;
    let viaticoReview = 0;

    for (const e of entries) {
      try {
        // --- transformaciones / reglas ---
        const dateMs = crMidnightMs(e.date);

        // B22: forzar isViatico=false en payroll/impuestos/fijos.
        let isViatico = e.isViatico;
        if (FORCE_NON_VIATICO.has(e.category)) {
          if (isViatico) viaticoForced++; // contamos solo los flips reales true→false
          isViatico = false;
        }

        const allow = e.kind === "income" ? INCOME_CATS : EXPENSE_CATS;
        if (!allow.has(e.category)) {
          unmappedCategory++;
          await ctx.db.insert("bi_quality_issues", {
            issueType: "unmapped_category",
            severity: "warn",
            entity: "finance_entries",
            entityRef: e.externalKey,
            detail: `categoría "${e.category}" fuera de allow-list (${e.kind})`,
            runId,
            detectedAt: now,
            resolved: false,
          });
        }

        const fxRate =
          e.fxRate === null || e.fxRate === undefined ? undefined : e.fxRate;
        if (e.originalCurrency === "USD" && fxRate === undefined) {
          fxMissing++;
          await ctx.db.insert("bi_quality_issues", {
            issueType: "fx_missing",
            severity: "error",
            entity: "finance_entries",
            entityRef: e.externalKey,
            detail: `USD sin fxRate (yearMonth=${e.yearMonth})`,
            runId,
            detectedAt: now,
            resolved: false,
          });
        }

        if (e.note && e.note.includes("viatico_review")) {
          viaticoReview++;
          await ctx.db.insert("bi_quality_issues", {
            issueType: "viatico_review",
            severity: "info",
            entity: "finance_entries",
            entityRef: e.externalKey,
            detail: `revisar taxonomía viático/payroll 2026 (cat=${e.category}, isViatico=${isViatico})`,
            runId,
            detectedAt: now,
            resolved: false,
          });
        }

        const originalAmount =
          e.originalAmount === null || e.originalAmount === undefined
            ? undefined
            : e.originalAmount;

        // `yearMonth` recalculado del epoch en zona CR (fuente de verdad para agrupar).
        const yearMonth = ymFromMs(dateMs);

        // --- upsert idempotente por externalKey ---
        const existing = await ctx.db
          .query("finance_entries")
          .withIndex("by_external_key", (q) =>
            q.eq("externalKey", e.externalKey),
          )
          .unique();

        const mutable = {
          kind: e.kind,
          category: e.category,
          isViatico,
          amountCRC: e.amountCRC,
          originalAmount,
          originalCurrency: e.originalCurrency,
          fxRate,
          date: dateMs,
          yearMonth,
          source: e.source,
          externalKey: e.externalKey,
          note: e.note,
          isDeleted: false,
          updatedAt: now,
        };

        if (existing) {
          await ctx.db.patch(existing._id, mutable);
          patched++;
        } else {
          await ctx.db.insert("finance_entries", {
            ...mutable,
            createdAt: now,
          });
          inserted++;
        }
      } catch (err) {
        failed++;
        await ctx.db.insert("bi_quality_issues", {
          issueType: "load_error",
          severity: "error",
          entity: "finance_entries",
          entityRef: e?.externalKey ?? "(sin externalKey)",
          detail: String(err instanceof Error ? err.message : err),
          runId,
          detectedAt: now,
          resolved: false,
        });
      }
    }

    return {
      received: entries.length,
      inserted,
      patched,
      failed,
      viaticoForced,
      unmappedCategory,
      fxMissing,
      viaticoReview,
    };
  },
});

/** Limpia issues de una corrida previa de la migración financiera (idempotencia del log). */
export const resetFinanceIssues = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("bi_quality_issues").collect();
    let deleted = 0;
    for (const r of rows) {
      if (r.entity === "finance_entries") {
        await ctx.db.delete(r._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

/** Upsert de `bi_meta` (frescura/estado del proceso, RF-09). */
export const setFinanceMeta = internalMutation({
  args: {
    status: v.union(v.literal("ok"), v.literal("error")),
    rowsProcessed: v.number(),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { status, rowsProcessed, message }) => {
    const existing = await ctx.db
      .query("bi_meta")
      .withIndex("by_key", (q) => q.eq("key", "finance_migration"))
      .unique();
    const doc = {
      key: "finance_migration",
      lastRunAt: Date.now(),
      lastStatus: status,
      rowsProcessed,
      message,
    };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("bi_meta", doc);
    return null;
  },
});

/* -------------------------------------------------------------------------- */
/* Conciliación                                                               */
/* -------------------------------------------------------------------------- */

/** Σ por mes (income/expense/utilidad) desde `finance_entries` para conciliar vs WP-3 §3. */
export const financeMonthlyTotals = internalQuery({
  args: {},
  returns: v.object({
    months: v.array(
      v.object({
        yearMonth: v.string(),
        rows: v.number(),
        income: v.number(),
        expense: v.number(),
        utilidad: v.number(),
      }),
    ),
    totals: v.object({
      rows: v.number(),
      income: v.number(),
      expense: v.number(),
      utilidad: v.number(),
      viaticoCount: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("finance_entries").collect();
    const byMonth = new Map<
      string,
      { rows: number; income: number; expense: number }
    >();
    let viaticoCount = 0;
    for (const r of rows) {
      if (r.isDeleted) continue;
      if (r.isViatico) viaticoCount++;
      const m = byMonth.get(r.yearMonth) ?? {
        rows: 0,
        income: 0,
        expense: 0,
      };
      m.rows++;
      if (r.kind === "income") m.income += r.amountCRC;
      else m.expense += r.amountCRC;
      byMonth.set(r.yearMonth, m);
    }
    const months = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([yearMonth, m]) => ({
        yearMonth,
        rows: m.rows,
        income: m.income,
        expense: m.expense,
        utilidad: m.income - m.expense,
      }));
    const totals = months.reduce(
      (acc, m) => ({
        rows: acc.rows + m.rows,
        income: acc.income + m.income,
        expense: acc.expense + m.expense,
        utilidad: acc.utilidad + m.utilidad,
        viaticoCount,
      }),
      { rows: 0, income: 0, expense: 0, utilidad: 0, viaticoCount },
    );
    return { months, totals };
  },
});
