import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

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
