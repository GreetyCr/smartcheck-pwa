import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
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
 * Solo admin. Tras completar todas las tandas de `backfillInspectionClientIds`
 * debe ser **0**. O(n) en filas; para volúmenes muy altos conviene cruzar con
 * el conteo aproximado en el Dashboard de Convex.
 */
export const countInspectionsMissingClientId = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("inspections").collect();
    return rows.filter((d) =>
      inspectionNeedsClientIdBackfill(d.clientId),
    ).length;
  },
});

/**
 * Asigna `clientId` (UUID v4) a filas legacy que no lo tienen.
 * Idempotente: no pisa `clientId` no vacío.
 *
 * Procesa **una tanda** de hasta `batchSize` documentos (orden de table scan)
 * para no acercarse al límite de tiempo de mutación en tablas grandes.
 * Repetir con `nextCursor` hasta `done === true` (ver `convex/README.md`).
 */
export const backfillInspectionClientIds = mutation({
  args: {
    /** Cursor devuelto por la invocación anterior; omitir o `null` en la primera. */
    cursor: v.optional(v.union(v.string(), v.null())),
    /** Filas leídas por tanda (1–1000; defecto 500). */
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    /** Documentos inspeccionados en esta tanda (= tamaño de página leída). */
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
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
  },
});
