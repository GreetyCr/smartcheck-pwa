import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { COMMISSION_SERVICE_FEE_CRC } from "./lib/commission";

function inspectionNeedsClientIdBackfill(
  clientId: string | undefined,
): boolean {
  if (clientId === undefined) return true;
  return clientId.trim() === "";
}

const CLIENT_ID_BACKFILL_BATCH_DEFAULT = 500;
const CLIENT_ID_BACKFILL_BATCH_MIN = 1;
const CLIENT_ID_BACKFILL_BATCH_MAX = 1000;

function clampClientIdBackfillBatchSize(raw: number | undefined): number {
  const n = Math.floor(raw ?? CLIENT_ID_BACKFILL_BATCH_DEFAULT);
  return Math.min(
    CLIENT_ID_BACKFILL_BATCH_MAX,
    Math.max(CLIENT_ID_BACKFILL_BATCH_MIN, n),
  );
}

/** Cuerpo compartido de `countInspectionsMissingClientId` y `countInspectionsMissingClientIdInternal`. */
async function countInspectionsMissingClientIdImpl(
  ctx: QueryCtx,
): Promise<number> {
  const rows = await ctx.db.query("inspections").collect();
  return rows.filter((d) =>
    inspectionNeedsClientIdBackfill(d.clientId),
  ).length;
}

const backfillReturns = v.object({
  scanned: v.number(),
  patched: v.number(),
  skipped: v.number(),
  errors: v.array(
    v.object({
      id: v.id("inspections"),
      reason: v.string(),
    }),
  ),
  done: v.boolean(),
  nextCursor: v.optional(v.string()),
});

const backfillArgs = {
  cursor: v.optional(v.union(v.string(), v.null())),
  batchSize: v.optional(v.number()),
};

/** Cuerpo compartido de `backfillInspectionClientIds` y `backfillInspectionClientIdsInternal`. */
async function backfillInspectionClientIdsImpl(
  ctx: MutationCtx,
  args: {
    cursor?: string | null;
    batchSize?: number;
  },
): Promise<{
  scanned: number;
  patched: number;
  skipped: number;
  errors: Array<{ id: Id<"inspections">; reason: string }>;
  done: boolean;
  nextCursor?: string;
}> {
  const batchSize = clampClientIdBackfillBatchSize(args.batchSize);
  const cursor = args.cursor === undefined ? null : args.cursor;

  const { page, isDone, continueCursor } = await ctx.db
    .query("inspections")
    .fullTableScan()
    .order("asc")
    .paginate({ numItems: batchSize, cursor });

  const errors: Array<{ id: Id<"inspections">; reason: string }> = [];
  let patched = 0;
  let skipped = 0;

  for (const doc of page) {
    if (!inspectionNeedsClientIdBackfill(doc.clientId)) {
      skipped++;
      continue;
    }
    try {
      await ctx.db.patch(doc._id, { clientId: crypto.randomUUID() });
      patched++;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      errors.push({ id: doc._id, reason });
    }
  }

  return {
    scanned: page.length,
    patched,
    skipped,
    errors,
    done: isDone,
    ...(isDone ? {} : { nextCursor: continueCursor }),
  };
}

/** Valores antiguos del wizard → catálogo actual. */
const LEGACY_TO_CURRENT: Record<
  string,
  "usa" | "nacional" | "panama" | "korea" | "otros"
> = {
  estados_unidos: "usa",
  corea: "korea",
  japon: "otros",
  alemania: "otros",
  mexico: "otros",
  otro: "otros",
};

/**
 * Normaliza `inspections.countryOfOrigin` al catálogo nuevo.
 *
 * **Se corre desde el botón de `/admin/configuracion` — A151.** Este comentario
 * decía «Convex Dashboard → Functions → run», y no es solo que quedara viejo
 * cuando se construyó el botón: **seguirlo falla siempre**, porque el handler
 * llama a `requireAdmin` y el Dashboard no manda JWT de Clerk. Mandaba a un
 * camino que no existe para hacer algo que ya se hace con un clic. Si hiciera
 * falta correrla sin sesión, habría que agregarle una gemela `*Internal` como
 * las de más abajo — hoy no hace falta.
 */
export const migrateLegacyCountryOfOrigin = mutation({
  args: {},
  returns: v.object({
    scanned: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("inspections").collect();
    let updated = 0;
    let skipped = 0;
    for (const doc of rows) {
      const raw = doc.countryOfOrigin;
      if (raw === undefined) {
        skipped++;
        continue;
      }
      const next = LEGACY_TO_CURRENT[raw];
      if (next === undefined) {
        skipped++;
        continue;
      }
      await ctx.db.patch(doc._id, { countryOfOrigin: next });
      updated++;
    }
    return { scanned: rows.length, updated, skipped };
  },
});

/**
 * Antes los técnicos sin campo se trataban como aprobados; ahora hace falta `approved` explícito.
 * Ejecutar **una vez** en prod tras el deploy que endurece `userHasFullAccess`.
 */
export const migrateLegacyTechnicianApproval = mutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("users").collect();
    let updated = 0;
    const now = Date.now();
    for (const u of rows) {
      if (u.role === "tecnico" && u.approvalStatus === undefined) {
        await ctx.db.patch(u._id, {
          approvalStatus: "approved",
          updatedAt: now,
        });
        updated++;
      }
    }
    return { updated };
  },
});

/**
 * Cuenta inspecciones sin `clientId` útil (ausente o solo espacios).
 * Requiere **sesión Clerk de admin** (p. ej. desde la app). El Dashboard de Convex
 * no envía JWT de Clerk: para operación sin usuario usar
 * `countInspectionsMissingClientIdInternal` + `npx convex run` (ver README).
 */
export const countInspectionsMissingClientId = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await countInspectionsMissingClientIdImpl(ctx);
  },
});

/**
 * Igual que `countInspectionsMissingClientId` pero **sin** Clerk.
 * Solo API **internal** (no accesible desde el browser público).
 * Verificación en prod: `npx convex run migrations:countInspectionsMissingClientIdInternal`
 */
export const countInspectionsMissingClientIdInternal = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    return await countInspectionsMissingClientIdImpl(ctx);
  },
});

/**
 * Asigna `clientId` (UUID v4) a filas legacy que no lo tienen.
 * Idempotente: no pisa `clientId` no vacío.
 *
 * Requiere **sesión Clerk de admin**. Para Dashboard / CLI sin JWT usar
 * `backfillInspectionClientIdsInternal`.
 */
export const backfillInspectionClientIds = mutation({
  args: backfillArgs,
  returns: backfillReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await backfillInspectionClientIdsImpl(ctx, args);
  },
});

/**
 * Igual que `backfillInspectionClientIds` pero **sin** Clerk.
 * Solo API **internal**. Ej.: `npx convex run migrations:backfillInspectionClientIdsInternal`
 */
export const backfillInspectionClientIdsInternal = internalMutation({
  args: backfillArgs,
  returns: backfillReturns,
  handler: async (ctx, args) => {
    return await backfillInspectionClientIdsImpl(ctx, args);
  },
});

/** Placas conocidas → monto total cobrado (colones enteros, sin separadores). */
const KNOWN_PLATE_TOTALS: Record<string, number> = {
  RTL007: 69_000,
  RLT007: 69_000,
  ABG888: 64_000,
  ABG884: 64_000,
  KN561373: 69_000,
  MJM205: 85_000,
  MMF412: 64_000,
};

const TEST_INSPECTION_TOTAL = 1_000;

function normalizePlateKey(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function plateKeysForInspection(doc: {
  identifier?: string;
  plateNumber?: string;
}): string[] {
  const keys = new Set<string>();
  const id = normalizePlateKey(doc.identifier);
  const plate = normalizePlateKey(doc.plateNumber);
  if (id) keys.add(id);
  if (plate) keys.add(plate);
  return [...keys];
}

function resolveTotalAmountCharged(doc: {
  identifier?: string;
  plateNumber?: string;
}): number {
  const keys = plateKeysForInspection(doc);
  for (const [plate, amount] of Object.entries(KNOWN_PLATE_TOTALS)) {
    if (keys.includes(plate)) return amount;
  }
  return TEST_INSPECTION_TOTAL;
}

const billingMigrationReturns = v.object({
  scanned: v.number(),
  updated: v.number(),
  byPlate: v.record(v.string(), v.number()),
});

async function migrateLegacyBillingFieldsImpl(ctx: MutationCtx): Promise<{
  scanned: number;
  updated: number;
  byPlate: Record<string, number>;
}> {
  const rows = await ctx.db.query("inspections").collect();
  const byPlate: Record<string, number> = {};
  let updated = 0;

  for (const doc of rows) {
    const total = resolveTotalAmountCharged(doc);
    const keys = plateKeysForInspection(doc);
    const label = keys.find((k) => k in KNOWN_PLATE_TOTALS) ?? keys[0] ?? "otros";
    byPlate[label] = (byPlate[label] ?? 0) + 1;

    await ctx.db.patch(doc._id, {
      inGam: "si",
      totalAmountCharged: total,
    });
    updated++;
  }

  return { scanned: rows.length, updated, byPlate };
}

/**
 * Backfill `inGam`, `totalAmountCharged` y limpia `outOfGamFee` en inspecciones legacy.
 * Todas las revisiones existentes se marcan en GAM; montos por placa según lista acordada;
 * el resto recibe 1000 (marcador de prueba).
 */
export const migrateLegacyBillingFields = mutation({
  args: {},
  returns: billingMigrationReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await migrateLegacyBillingFieldsImpl(ctx);
  },
});

/** Igual que `migrateLegacyBillingFields` sin sesión Clerk (CLI / Dashboard). */
export const migrateLegacyBillingFieldsInternal = internalMutation({
  args: {},
  returns: billingMigrationReturns,
  handler: async (ctx) => {
    return await migrateLegacyBillingFieldsImpl(ctx);
  },
});

const traccionBackfillReturns = v.object({
  inspections: v.number(),
  inserted: v.number(),
  patched: v.number(),
  skipped: v.number(),
});

const DEFAULT_TIPO_TRACCION = { value: "2wd" as const };

/**
 * Crea fila `section_traccion` faltante y asigna `tipo_traccion: 2wd` en legacy
 * (reportes sin sección o con campos antiguos).
 */
async function backfillTraccionSectionImpl(ctx: MutationCtx) {
  let inserted = 0;
  let patched = 0;
  let skipped = 0;

  const inspections = await ctx.db.query("inspections").collect();

  for (const ins of inspections) {
    const existing = await ctx.db
      .query("section_traccion")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", ins._id))
      .first();

    if (!existing) {
      await ctx.db.insert("section_traccion", {
        inspectionId: ins._id,
        tipo_traccion: DEFAULT_TIPO_TRACCION,
      });
      inserted += 1;
      continue;
    }

    const row = existing as Record<string, unknown>;
    const tipo = row.tipo_traccion;
    const needsDefault =
      tipo === undefined ||
      tipo === null ||
      row.funcionamiento !== undefined ||
      row.accionamiento_2h_4h_4l !== undefined;

    if (needsDefault) {
      await ctx.db.patch(existing._id, {
        tipo_traccion: DEFAULT_TIPO_TRACCION,
      });
      patched += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    inspections: inspections.length,
    inserted,
    patched,
    skipped,
  };
}

export const backfillTraccionSection = mutation({
  args: {},
  returns: traccionBackfillReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await backfillTraccionSectionImpl(ctx);
  },
});

export const backfillTraccionSectionInternal = internalMutation({
  args: {},
  returns: traccionBackfillReturns,
  handler: async (ctx) => {
    return await backfillTraccionSectionImpl(ctx);
  },
});

const commissionBackfillStatsReturns = v.object({
  total: v.number(),
  withCommission: v.number(),
  withoutCommission: v.number(),
  needsFeeBackfill: v.number(),
});

const commissionBackfillReturns = v.object({
  inspections: v.number(),
  withCommission: v.number(),
  patchedCommission: v.number(),
  patchedZero: v.number(),
  skipped: v.number(),
});

function commissionFeeNeedsBackfill(
  biCommission: "si" | "no" | undefined,
  commissionFeeAmount: number | undefined,
): boolean {
  if (biCommission === "si") {
    return commissionFeeAmount !== COMMISSION_SERVICE_FEE_CRC;
  }
  return commissionFeeAmount !== 0;
}

async function countCommissionBackfillStatsImpl(ctx: QueryCtx) {
  const rows = await ctx.db.query("inspections").collect();
  let withCommission = 0;
  let withoutCommission = 0;
  let needsFeeBackfill = 0;

  for (const row of rows) {
    const flag = row.biCommission;
    if (flag === "si") {
      withCommission += 1;
    } else {
      withoutCommission += 1;
    }
    if (commissionFeeNeedsBackfill(flag, row.commissionFeeAmount)) {
      needsFeeBackfill += 1;
    }
  }

  return {
    total: rows.length,
    withCommission,
    withoutCommission,
    needsFeeBackfill,
  };
}

/**
 * Conteo previo al backfill de `commissionFeeAmount` (₡5,000 si `biCommission === "si"`, si no `0`).
 */
export const countCommissionBackfillStats = query({
  args: {},
  returns: commissionBackfillStatsReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await countCommissionBackfillStatsImpl(ctx);
  },
});

export const countCommissionBackfillStatsInternal = internalQuery({
  args: {},
  returns: commissionBackfillStatsReturns,
  handler: async (ctx) => {
    return await countCommissionBackfillStatsImpl(ctx);
  },
});

async function backfillCommissionFeeAmountImpl(ctx: MutationCtx) {
  const rows = await ctx.db.query("inspections").collect();
  let withCommission = 0;
  let patchedCommission = 0;
  let patchedZero = 0;
  let skipped = 0;

  for (const row of rows) {
    const flag = row.biCommission;
    const current = row.commissionFeeAmount;

    if (flag === "si") {
      withCommission += 1;
      if (current === COMMISSION_SERVICE_FEE_CRC) {
        skipped += 1;
        continue;
      }
      await ctx.db.patch(row._id, {
        commissionFeeAmount: COMMISSION_SERVICE_FEE_CRC,
      });
      patchedCommission += 1;
      continue;
    }

    if (current === 0) {
      skipped += 1;
      continue;
    }
    await ctx.db.patch(row._id, { commissionFeeAmount: 0 });
    patchedZero += 1;
  }

  return {
    inspections: rows.length,
    withCommission,
    patchedCommission,
    patchedZero,
    skipped,
  };
}

export const backfillCommissionFeeAmount = mutation({
  args: {},
  returns: commissionBackfillReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await backfillCommissionFeeAmountImpl(ctx);
  },
});

export const backfillCommissionFeeAmountInternal = internalMutation({
  args: {},
  returns: commissionBackfillReturns,
  handler: async (ctx) => {
    return await backfillCommissionFeeAmountImpl(ctx);
  },
});

const captureSourceRenameReturns = v.object({
  inspectionsScanned: v.number(),
  inspectionsPatched: v.number(),
  leadsScanned: v.number(),
  leadsPatched: v.number(),
});

/**
 * Renombra `captureSource` / canal de leads `publicidad` → `mercadeo`
 * (UI: «Cómo nos conoció»). Idempotente.
 */
async function migratePublicidadToMercadeoImpl(ctx: MutationCtx) {
  const inspections = await ctx.db.query("inspections").collect();
  let inspectionsPatched = 0;
  for (const row of inspections) {
    if (row.captureSource !== "publicidad") continue;
    await ctx.db.patch(row._id, { captureSource: "mercadeo" });
    inspectionsPatched += 1;
  }

  let leadsScanned = 0;
  let leadsPatched = 0;
  try {
    const leads = await ctx.db.query("leads_contacts").collect();
    leadsScanned = leads.length;
    for (const row of leads) {
      if (row.channel !== "publicidad") continue;
      await ctx.db.patch(row._id, { channel: "mercadeo" });
      leadsPatched += 1;
    }
  } catch {
    // Tabla leads puede no existir en entornos sin BI aún.
  }

  return {
    inspectionsScanned: inspections.length,
    inspectionsPatched,
    leadsScanned,
    leadsPatched,
  };
}

export const migratePublicidadToMercadeo = mutation({
  args: {},
  returns: captureSourceRenameReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await migratePublicidadToMercadeoImpl(ctx);
  },
});

/** Igual sin sesión Clerk (CLI / Dashboard). */
export const migratePublicidadToMercadeoInternal = internalMutation({
  args: {},
  returns: captureSourceRenameReturns,
  handler: async (ctx) => {
    return await migratePublicidadToMercadeoImpl(ctx);
  },
});
