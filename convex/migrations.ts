import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

function inspectionNeedsClientIdBackfill(
  clientId: string | undefined,
): boolean {
  if (clientId === undefined) return true;
  return clientId.trim() === "";
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
 * Solo admin. Tras `backfillInspectionClientIds` debe ser **0**.
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
 * Idempotente: no pisa `clientId` no vacío. Ejecutar una vez como admin
 * (Convex Dashboard → Functions → run).
 */
export const backfillInspectionClientIds = mutation({
  args: {},
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("inspections").collect();
    let patched = 0;
    let skipped = 0;
    for (const doc of rows) {
      if (!inspectionNeedsClientIdBackfill(doc.clientId)) {
        skipped++;
        continue;
      }
      await ctx.db.patch(doc._id, { clientId: crypto.randomUUID() });
      patched++;
    }
    return { scanned: rows.length, patched, skipped };
  },
});
