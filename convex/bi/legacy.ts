/**
 * WP-L — Carga idempotente del CRM histórico de inspecciones en `inspections_legacy`.
 *
 * Patrón (AGENTS §7.6, MODELO-DATOS §8/§6): `internalMutation` por lotes, upsert
 * idempotente por `sourceRowId` (`withIndex("by_source_row").unique()` → patch/insert),
 * con try/catch por fila (fila mala → `bi_quality_issues`, nunca aborta el lote).
 *
 * Fuente: Google Sheet "CRM Smartcheck", pestaña `CRM` (744 filas, frozen). El mapeo
 * (moneda por magnitud + FX WP-2, normalización tel/placa, flags) se hace en el driver
 * de scratchpad y llega ya resuelto; esta mutation solo valida, upserta y loguea.
 *
 * SOLO DEV en este WP. Import único (histórico congelado). No re-migra finanzas.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { yearMonth as ymFromMs } from "./lib/dates";

/** Canales conocidos del CRM (Fuente). Fuera de lista → issue `unmapped_channel` (info), pero se carga. */
const KNOWN_CHANNELS = new Set([
  "Mercadeo",
  "Publicidad",
  "Recompra",
  "Referido",
  "Tik Tok",
  "Buscador",
]);

/* -------------------------------------------------------------------------- */
/* Validadores                                                                */
/* -------------------------------------------------------------------------- */

const rawRow = v.object({
  sourceRowId: v.string(),
  inspectionDate: v.number(), // epoch ms CR; 0 = sentinela sin fecha
  clientName: v.optional(v.string()),
  phone8: v.optional(v.string()),
  plate: v.optional(v.string()),
  vehicleBrand: v.optional(v.string()),
  vehicleModel: v.optional(v.string()),
  engineType: v.optional(v.string()),
  channel: v.optional(v.string()),
  province: v.optional(v.string()),
  amountCRC: v.optional(v.number()),
  originalAmount: v.optional(v.number()),
  originalCurrency: v.union(v.literal("CRC"), v.literal("USD")),
  fxRate: v.optional(v.number()),
  reportLink: v.optional(v.string()),
  note: v.optional(v.string()),
});

const batchResult = v.object({
  received: v.number(),
  inserted: v.number(),
  patched: v.number(),
  failed: v.number(),
  unmappedChannel: v.number(),
});

/* -------------------------------------------------------------------------- */
/* Carga idempotente por lotes                                                */
/* -------------------------------------------------------------------------- */

export const loadLegacyBatch = internalMutation({
  args: { rows: v.array(rawRow), runId: v.string() },
  returns: batchResult,
  handler: async (ctx, { rows, runId }) => {
    const now = Date.now();
    let inserted = 0;
    let patched = 0;
    let failed = 0;
    let unmappedChannel = 0;

    for (const r of rows) {
      try {
        if (r.channel && !KNOWN_CHANNELS.has(r.channel)) {
          unmappedChannel++;
          await ctx.db.insert("bi_quality_issues", {
            issueType: "unmapped_channel",
            severity: "info",
            entity: "inspections_legacy",
            entityRef: r.sourceRowId,
            detail: `canal fuera de vocabulario CRM: "${r.channel}"`,
            runId,
            detectedAt: now,
            resolved: false,
          });
        }

        const doc = {
          sourceRowId: r.sourceRowId,
          inspectionDate: r.inspectionDate,
          clientName: r.clientName,
          phone8: r.phone8,
          plate: r.plate,
          vehicleBrand: r.vehicleBrand,
          vehicleModel: r.vehicleModel,
          engineType: r.engineType,
          channel: r.channel,
          province: r.province,
          amountCRC: r.amountCRC,
          originalAmount: r.originalAmount,
          originalCurrency: r.originalCurrency,
          fxRate: r.fxRate,
          reportLink: r.reportLink,
          note: r.note,
        };

        const existing = await ctx.db
          .query("inspections_legacy")
          .withIndex("by_source_row", (q) =>
            q.eq("sourceRowId", r.sourceRowId),
          )
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, doc);
          patched++;
        } else {
          await ctx.db.insert("inspections_legacy", doc);
          inserted++;
        }
      } catch (err) {
        failed++;
        await ctx.db.insert("bi_quality_issues", {
          issueType: "load_error",
          severity: "error",
          entity: "inspections_legacy",
          entityRef: r?.sourceRowId ?? "(sin sourceRowId)",
          detail: String(err instanceof Error ? err.message : err),
          runId,
          detectedAt: now,
          resolved: false,
        });
      }
    }

    return { received: rows.length, inserted, patched, failed, unmappedChannel };
  },
});

/**
 * Registra los issues de mapeo precomputados por el driver (missing_date,
 * anomalous_phone, outlier_amount, currency_ambiguous, zero_or_missing_amount,
 * malformed_row). Idempotente vía `resetLegacyIssues` previo.
 */
export const loadLegacyIssues = internalMutation({
  args: {
    issues: v.array(
      v.object({
        issueType: v.string(),
        severity: v.union(
          v.literal("info"),
          v.literal("warn"),
          v.literal("error"),
        ),
        entityRef: v.string(),
        detail: v.optional(v.string()),
      }),
    ),
    runId: v.string(),
  },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, { issues, runId }) => {
    const now = Date.now();
    let insertedCount = 0;
    for (const i of issues) {
      await ctx.db.insert("bi_quality_issues", {
        issueType: i.issueType,
        severity: i.severity,
        entity: "inspections_legacy",
        entityRef: i.entityRef,
        detail: i.detail,
        runId,
        detectedAt: now,
        resolved: false,
      });
      insertedCount++;
    }
    return { inserted: insertedCount };
  },
});

/** Limpia issues de corridas previas del import legacy (idempotencia del log). */
export const resetLegacyIssues = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("bi_quality_issues").collect();
    let deleted = 0;
    for (const r of rows) {
      if (r.entity === "inspections_legacy") {
        await ctx.db.delete(r._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

/** Upsert de `bi_meta` (frescura/estado del proceso, RF-09). key = "legacy_migration". */
export const setLegacyMeta = internalMutation({
  args: {
    status: v.union(v.literal("ok"), v.literal("error")),
    rowsProcessed: v.number(),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { status, rowsProcessed, message }) => {
    const existing = await ctx.db
      .query("bi_meta")
      .withIndex("by_key", (q) => q.eq("key", "legacy_migration"))
      .unique();
    const doc = {
      key: "legacy_migration",
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
/* Validación                                                                 */
/* -------------------------------------------------------------------------- */

const CUTOVER_MS = Date.parse("2026-07-01T00:00:00-06:00");

/** Resumen de validación desde DEV: conteos, dedup por corte, Σ/mes, canales, FX. */
export const legacyStats = internalQuery({
  args: {},
  returns: v.object({
    total: v.number(),
    withDate: v.number(),
    sentinelDate: v.number(),
    beforeCutover: v.number(),
    fromCutover: v.number(),
    minDate: v.number(),
    maxDate: v.number(),
    phone8Present: v.number(),
    platePresent: v.number(),
    withAmount: v.number(),
    usdRows: v.number(),
    crcRows: v.number(),
    fxMin: v.number(),
    fxMax: v.number(),
    totalAmountCRC: v.number(),
    months: v.array(
      v.object({ ym: v.string(), rows: v.number(), amountCRC: v.number() }),
    ),
    channels: v.array(v.object({ channel: v.string(), rows: v.number() })),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("inspections_legacy").collect();
    let withDate = 0,
      sentinelDate = 0,
      beforeCutover = 0,
      fromCutover = 0,
      phone8Present = 0,
      platePresent = 0,
      withAmount = 0,
      usdRows = 0,
      crcRows = 0,
      totalAmountCRC = 0;
    let minDate = Number.POSITIVE_INFINITY,
      maxDate = 0,
      fxMin = Number.POSITIVE_INFINITY,
      fxMax = 0;
    const byMonth = new Map<string, { rows: number; amountCRC: number }>();
    const byChannel = new Map<string, number>();
    for (const r of rows) {
      if (r.inspectionDate > 0) {
        withDate++;
        if (r.inspectionDate < minDate) minDate = r.inspectionDate;
        if (r.inspectionDate > maxDate) maxDate = r.inspectionDate;
        if (r.inspectionDate < CUTOVER_MS) beforeCutover++;
        else fromCutover++;
      } else sentinelDate++;
      if (r.phone8) phone8Present++;
      if (r.plate) platePresent++;
      if (r.amountCRC !== undefined) {
        withAmount++;
        totalAmountCRC += r.amountCRC;
      }
      if (r.originalCurrency === "USD") usdRows++;
      else crcRows++;
      if (r.fxRate !== undefined) {
        if (r.fxRate < fxMin) fxMin = r.fxRate;
        if (r.fxRate > fxMax) fxMax = r.fxRate;
      }
      const ym = r.inspectionDate > 0 ? ymFromMs(r.inspectionDate) : "sin-fecha";
      const m = byMonth.get(ym) ?? { rows: 0, amountCRC: 0 };
      m.rows++;
      m.amountCRC += r.amountCRC ?? 0;
      byMonth.set(ym, m);
      const ch = r.channel ?? "(vacío)";
      byChannel.set(ch, (byChannel.get(ch) ?? 0) + 1);
    }
    return {
      total: rows.length,
      withDate,
      sentinelDate,
      beforeCutover,
      fromCutover,
      minDate: Number.isFinite(minDate) ? minDate : 0,
      maxDate,
      phone8Present,
      platePresent,
      withAmount,
      usdRows,
      crcRows,
      fxMin: Number.isFinite(fxMin) ? fxMin : 0,
      fxMax,
      totalAmountCRC,
      months: [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ym, m]) => ({ ym, rows: m.rows, amountCRC: m.amountCRC })),
      channels: [...byChannel.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([channel, rows]) => ({ channel, rows })),
    };
  },
});

/* -------------------------------------------------------------------------- */
/* WP-L2 — Correcciones de Esteban (idempotentes, SOLO DEV)                   */
/* -------------------------------------------------------------------------- */

/**
 * Regla de magnitud confirmada por Esteban: todos los montos de 3 dígitos del
 * CRM son dólares. Estas correcciones fijan `originalCurrency=USD`, convierten a
 * `amountCRC` con la tasa del día (método WP-2: cierre diario fxratesapi.com,
 * fines de semana forward-fill) y resuelven el issue correspondiente.
 *
 * Tasas USD→CRC usadas (dataset diario completo en
 * `docs/handoffs/F1-WP2-fx-rates-ext.json`; el F1-WP2-fx-rates.json base no
 * existía en el repo, así que WP-L2 construyó el rango requerido). El helper
 * `rateForDate` de WP-2 (`lib/fx.ts`) aún no existe: incrustamos aquí las tasas
 * de las fechas tocadas para mantener el cambio acotado a este archivo.
 *
 * Idempotente: re-correr converge al mismo estado (mismos montos, mismos issues
 * resueltos, delete de la fila de prueba no-op si ya no existe).
 */
const FX_USD_CRC: Record<string, number> = {
  "2026-03-02": 470.47, // Toyota Corolla 2017 (I5, FX canónico F1-FX-canonical.json)
  "2025-10-08": 503.237464, // Hyundai Kona
  "2025-12-06": 488.643365, // Byron (sábado → forward-fill viernes 2025-12-05)
  "2025-12-10": 494.159654, // Jordan
  "2026-05-13": 455.826295, // Jason Rojas
  "2026-05-26": 452.405033, // Rolando
  "2026-05-29": 452.96005, // Earl Junier
  "2026-07-02": 455.462537, // Abdul
};

/** Medianoche CR (UTC-6 fijo) para una fecha ISO "YYYY-MM-DD". */
const crMidnightMs = (iso: string): number =>
  Date.parse(`${iso}T00:00:00-06:00`);

/** Tasa USD→CRC de la fecha ISO (falla ruidosa si falta, nunca silenciosa). */
function rateForDate(iso: string): number {
  const r = FX_USD_CRC[iso];
  if (r === undefined) throw new Error(`FX ausente para ${iso} (WP-L2)`);
  return r;
}

type CorrectionAction =
  | "convertUSD" // fija USD + convierte, mantiene fecha
  | "setDateConvertUSD" // fija fecha + USD + convierte
  | "pendingDateUSD" // USD sin convertir, amountCRC=null, issue pending_date
  | "confirmOutlier" // mantiene monto, resuelve outlier
  | "deleteRow"; // fila de prueba: elimina fila + sus issues

type Correction = {
  sourceRowId: string;
  expectName: string; // aserción de seguridad (no tocar la fila equivocada)
  action: CorrectionAction;
  dateISO?: string;
  usd?: number;
  resolveIssues?: string[];
  note?: string;
};

const WP_L2_CORRECTIONS: Correction[] = [
  {
    sourceRowId: "crm:457",
    expectName: "Rolando",
    action: "convertUSD",
    dateISO: "2026-05-26",
    usd: 120,
    resolveIssues: ["currency_ambiguous"],
  },
  {
    sourceRowId: "crm:crm:pos:648",
    expectName: "Earl Junier",
    action: "convertUSD",
    dateISO: "2026-05-29",
    usd: 132,
    resolveIssues: ["currency_ambiguous"],
  },
  {
    sourceRowId: "crm:crm:pos:722",
    expectName: "Abdul",
    action: "convertUSD",
    dateISO: "2026-07-02",
    usd: 154,
    resolveIssues: ["currency_ambiguous"],
  },
  {
    sourceRowId: "crm:crm:pos:299",
    expectName: "Hyundai Kona 2023",
    action: "setDateConvertUSD",
    dateISO: "2025-10-08",
    usd: 180,
    resolveIssues: ["missing_date", "currency_ambiguous"],
  },
  {
    sourceRowId: "crm:crm:pos:617",
    expectName: "Jason Rojas",
    action: "convertUSD",
    dateISO: "2026-05-13",
    usd: 135,
    resolveIssues: ["zero_or_missing_amount"],
  },
  {
    sourceRowId: "crm:crm:pos:391",
    expectName: "Jordan",
    action: "convertUSD",
    dateISO: "2025-12-10",
    usd: 135,
    resolveIssues: ["zero_or_missing_amount"],
  },
  {
    sourceRowId: "crm:crm:pos:389",
    expectName: "Byron",
    action: "convertUSD",
    dateISO: "2025-12-06",
    usd: 135,
    resolveIssues: ["zero_or_missing_amount"],
  },
  {
    sourceRowId: "crm:crm:pos:483",
    expectName: "Toyota Corolla 2017",
    action: "setDateConvertUSD", // I5 cerrado: Esteban confirmó fecha 02/03/2026 y $135
    dateISO: "2026-03-02",
    usd: 135,
    resolveIssues: ["missing_date", "zero_or_missing_amount", "pending_date"],
  },
  {
    sourceRowId: "crm:crm:pos:537",
    expectName: "Hans Villalobos",
    action: "deleteRow", // registro de PRUEBA de otro dev
  },
  {
    sourceRowId: "crm:crm:pos:533",
    expectName: "Gabriel",
    action: "confirmOutlier",
    resolveIssues: ["outlier_amount"],
    note: "confirmado fuera del GAM",
  },
];

const RESOLVED_MARK = " | WP-L2:";

/** Marca resueltos los issues abiertos de un ref/tipo (idempotente). */
async function resolveIssuesFor(
  ctx: MutationCtx,
  sourceRowId: string,
  issueTypes: string[],
  note: string,
): Promise<number> {
  const all = await ctx.db
    .query("bi_quality_issues")
    .withIndex("by_run")
    .collect();
  let n = 0;
  for (const it of all) {
    if (
      it.entity === "inspections_legacy" &&
      it.entityRef === sourceRowId &&
      issueTypes.includes(it.issueType)
    ) {
      const base = String(it.detail ?? "").split(RESOLVED_MARK)[0];
      await ctx.db.patch(it._id, {
        resolved: true,
        detail: `${base}${RESOLVED_MARK} ${note}`,
      });
      n++;
    }
  }
  return n;
}

export const applyLegacyCorrections = internalMutation({
  args: { runId: v.string() },
  returns: v.object({
    rowsPatched: v.number(),
    rowsDeleted: v.number(),
    issuesResolved: v.number(),
    pendingDateEnsured: v.number(),
    log: v.array(v.string()),
  }),
  handler: async (ctx, { runId }) => {
    const now = Date.now();
    let rowsPatched = 0;
    let rowsDeleted = 0;
    let issuesResolved = 0;
    let pendingDateEnsured = 0;
    const log: string[] = [];

    for (const c of WP_L2_CORRECTIONS) {
      const row = await ctx.db
        .query("inspections_legacy")
        .withIndex("by_source_row", (q) =>
          q.eq("sourceRowId", c.sourceRowId),
        )
        .unique();

      if (c.action === "deleteRow") {
        if (row) {
          if (row.clientName && row.clientName !== c.expectName) {
            throw new Error(
              `Aserción falló en ${c.sourceRowId}: esperaba "${c.expectName}", encontré "${row.clientName}"`,
            );
          }
          await ctx.db.delete(row._id);
          rowsDeleted++;
          log.push(`DELETE ${c.sourceRowId} (${c.expectName})`);
        }
        // eliminar issues huérfanos de la fila de prueba (idempotente)
        const issues = await ctx.db.query("bi_quality_issues").collect();
        for (const it of issues) {
          if (
            it.entity === "inspections_legacy" &&
            it.entityRef === c.sourceRowId
          ) {
            await ctx.db.delete(it._id);
          }
        }
        continue;
      }

      if (!row) {
        log.push(`SKIP ${c.sourceRowId}: fila no encontrada`);
        continue;
      }
      if (row.clientName && row.clientName !== c.expectName) {
        throw new Error(
          `Aserción falló en ${c.sourceRowId}: esperaba "${c.expectName}", encontré "${row.clientName}"`,
        );
      }

      if (c.action === "confirmOutlier") {
        // mantener monto tal cual; solo resolver el issue
        const n = await resolveIssuesFor(
          ctx,
          c.sourceRowId,
          c.resolveIssues ?? [],
          c.note ?? "confirmado",
        );
        issuesResolved += n;
        log.push(
          `CONFIRM ${c.sourceRowId} (${c.expectName}) monto=${row.amountCRC} intacto; ${c.note}`,
        );
        continue;
      }

      if (c.action === "pendingDateUSD") {
        await ctx.db.patch(row._id, {
          originalAmount: c.usd,
          originalCurrency: "USD" as const,
          amountCRC: undefined,
          fxRate: undefined,
          note: `WP-L2: USD $${c.usd} confirmado por magnitud; sin fecha (reportLink no legible, 401) → pendiente`,
        });
        rowsPatched++;
        issuesResolved += await resolveIssuesFor(
          ctx,
          c.sourceRowId,
          c.resolveIssues ?? [],
          "reemplazado por pending_date",
        );
        // asegurar exactamente un pending_date abierto (idempotente)
        const existing = (await ctx.db.query("bi_quality_issues").collect()).filter(
          (it) =>
            it.entity === "inspections_legacy" &&
            it.entityRef === c.sourceRowId &&
            it.issueType === "pending_date",
        );
        if (existing.length === 0) {
          await ctx.db.insert("bi_quality_issues", {
            issueType: "pending_date",
            severity: "warn" as const,
            entity: "inspections_legacy",
            entityRef: c.sourceRowId,
            detail: `USD $${c.usd} confirmado; falta fecha de inspección (no inventada)`,
            runId,
            detectedAt: now,
            resolved: false,
          });
          pendingDateEnsured++;
        }
        log.push(
          `PENDING ${c.sourceRowId} (${c.expectName}) USD $${c.usd}, amountCRC=null, pending_date`,
        );
        continue;
      }

      // convertUSD | setDateConvertUSD
      const iso = c.dateISO!;
      const fx = rateForDate(iso);
      const usd = c.usd!;
      const amountCRC = Math.round(usd * fx);
      const patch: Record<string, unknown> = {
        originalAmount: usd,
        originalCurrency: "USD" as const,
        fxRate: fx,
        amountCRC,
        note: `WP-L2: USD $${usd} confirmado por magnitud; convertido @${fx} (${iso})`,
      };
      if (c.action === "setDateConvertUSD") {
        patch.inspectionDate = crMidnightMs(iso);
      }
      await ctx.db.patch(row._id, patch);
      rowsPatched++;
      issuesResolved += await resolveIssuesFor(
        ctx,
        c.sourceRowId,
        c.resolveIssues ?? [],
        `USD confirmado; convertido @${fx} (${iso})`,
      );
      log.push(
        `CONVERT ${c.sourceRowId} (${c.expectName}) $${usd}×${fx} → ₡${amountCRC} @${iso}`,
      );
    }

    return {
      rowsPatched,
      rowsDeleted,
      issuesResolved,
      pendingDateEnsured,
      log,
    };
  },
});
