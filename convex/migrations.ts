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
 * Ejecutar una vez como admin (Convex Dashboard → Functions → run).
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
