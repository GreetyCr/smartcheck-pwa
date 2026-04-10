import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { canAccessInspection, requireAuth } from "./lib/auth";

/** Orden del flujo (catálogo Módulo 2.2) — índice `by_inspection` en cada tabla. */
export const SECTION_TABLE_ORDER = [
  "section_motor",
  "section_transmision",
  "section_electrico",
  "section_frenos",
  "section_suspension",
  "section_direccion",
  "section_escape",
  "section_neumaticos",
  "section_combustible",
  "section_electronica",
  "section_iluminacion",
  "section_accesorios",
  "section_ac_calefaccion",
  "section_seguridad",
  "section_carroceria",
  "section_conduccion",
  "section_traccion",
  "section_finalizacion",
] as const;

export type SectionTable = (typeof SECTION_TABLE_ORDER)[number];

/** Campos requeridos para considerar la sección completa (excl. photos, inspectionId, itemPhotos). */
const SECTION_ITEM_TOTALS: Record<SectionTable, number> = {
  section_motor: 11,
  section_transmision: 9,
  section_electrico: 5,
  section_frenos: 6,
  section_suspension: 4,
  section_direccion: 3,
  section_escape: 3,
  section_neumaticos: 3,
  section_combustible: 2,
  section_electronica: 5,
  section_iluminacion: 6,
  section_accesorios: 21,
  section_ac_calefaccion: 4,
  section_seguridad: 6,
  section_carroceria: 10,
  section_conduccion: 7,
  section_traccion: 4,
  section_finalizacion: 3,
};

function isItemFieldKey(key: string): boolean {
  return (
    key !== "photos" &&
    key !== "itemPhotos" &&
    key !== "inspectionId" &&
    key !== "_id" &&
    key !== "_creationTime"
  );
}

function countFilledItemFields(doc: Record<string, unknown>): number {
  let n = 0;
  for (const key of Object.keys(doc)) {
    if (!isItemFieldKey(key)) continue;
    const val = doc[key];
    if (val === undefined || val === null) continue;
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const o = val as Record<string, unknown>;
      if ("value" in o && o.value !== undefined && o.value !== null) {
        n++;
        continue;
      }
      if ("texto" in o && typeof o.texto === "string" && o.texto.trim() !== "") {
        n++;
        continue;
      }
      if (key === "comentario_final" && o.texto !== undefined) {
        n++;
        continue;
      }
      if (key === "fabricacion" && typeof o === "string" && String(o).trim() !== "") {
        n++;
        continue;
      }
      if (key === "desgaste" && o.value !== undefined) {
        n++;
        continue;
      }
    } else if (typeof val === "string" && val.trim() !== "") {
      n++;
    } else if (typeof val === "number") {
      n++;
    }
  }
  return n;
}

function countFindingsInValue(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "object" && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    if ("value" in o) {
      const vv = o.value;
      if (vv === "reparacion" || vv === "no") return 1;
    }
    let sum = 0;
    for (const k of Object.keys(o)) {
      sum += countFindingsInValue(o[k]);
    }
    return sum;
  }
  return 0;
}

function countFindingsInDoc(doc: Record<string, unknown>): number {
  let sum = 0;
  for (const key of Object.keys(doc)) {
    if (!isItemFieldKey(key)) continue;
    sum += countFindingsInValue(doc[key]);
  }
  return sum;
}

export async function getSectionDoc(
  ctx: QueryCtx | MutationCtx,
  table: SectionTable,
  inspectionId: Id<"inspections">,
): Promise<Doc<SectionTable> | null> {
  return await ctx.db
    .query(table)
    .withIndex("by_inspection", (q) => q.eq("inspectionId", inspectionId))
    .unique();
}

export function isSectionTable(name: string): name is SectionTable {
  return (SECTION_TABLE_ORDER as readonly string[]).includes(name);
}

async function deleteAllSectionsForInspection(
  ctx: MutationCtx,
  inspectionId: Id<"inspections">,
) {
  for (const table of SECTION_TABLE_ORDER) {
    const doc = await getSectionDoc(ctx, table, inspectionId);
    if (doc) await ctx.db.delete(doc._id);
  }
}

export type SectionUiStatus = "completado" | "en_curso" | "pendiente";

export const listSectionSummaries = query({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, { inspectionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const allowed = await canAccessInspection(ctx, inspectionId);
    if (!allowed) throw new Error("No autorizado");

    const rows: {
      table: SectionTable;
      filled: number;
      total: number;
      findings: number;
      complete: boolean;
    }[] = [];

    for (const table of SECTION_TABLE_ORDER) {
      const doc = await getSectionDoc(ctx, table, inspectionId);
      const total = SECTION_ITEM_TOTALS[table];
      if (!doc) {
        rows.push({ table, filled: 0, total, findings: 0, complete: false });
        continue;
      }
      const plain = doc as unknown as Record<string, unknown>;
      const filled = countFilledItemFields(plain);
      const findings = countFindingsInDoc(plain);
      const complete = total > 0 && filled >= total;
      rows.push({ table, filled, total, findings, complete });
    }

    const firstIncomplete = rows.findIndex((r) => !r.complete);
    const summaries = rows.map((r, i) => {
      let status: SectionUiStatus;
      if (r.complete) {
        status = "completado";
      } else if (i === firstIncomplete) {
        status = "en_curso";
      } else {
        status = "pendiente";
      }
      return {
        table: r.table,
        filled: r.filled,
        total: r.total,
        findings: r.findings,
        status,
      };
    });

    const completedCount = rows.filter((r) => r.complete).length;
    const progressPercent =
      SECTION_TABLE_ORDER.length > 0
        ? Math.round((completedCount / SECTION_TABLE_ORDER.length) * 100)
        : 0;

    return {
      summaries,
      completedCount,
      totalSections: SECTION_TABLE_ORDER.length,
      progressPercent,
    };
  },
});

export const ensureSectionRows = mutation({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, { inspectionId }) => {
    await requireAuth(ctx);
    const allowed = await canAccessInspection(ctx, inspectionId);
    if (!allowed) throw new Error("No autorizado");

    for (const table of SECTION_TABLE_ORDER) {
      const existing = await getSectionDoc(ctx, table, inspectionId);
      if (!existing) {
        await ctx.db.insert(table, { inspectionId });
      }
    }
  },
});

export const touchDraft = mutation({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, { inspectionId }) => {
    await requireAuth(ctx);
    const allowed = await canAccessInspection(ctx, inspectionId);
    if (!allowed) throw new Error("No autorizado");
    await ctx.db.patch(inspectionId, { status: "draft" });
  },
});

export const discardInspection = mutation({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, { inspectionId }) => {
    await requireAuth(ctx);
    const allowed = await canAccessInspection(ctx, inspectionId);
    if (!allowed) throw new Error("No autorizado");
    await deleteAllSectionsForInspection(ctx, inspectionId);
    await ctx.db.delete(inspectionId);
  },
});

/** Obtiene el documento de una tabla de sección (cualquier tabla del catálogo). */
export const getSection = query({
  args: {
    inspectionId: v.id("inspections"),
    sectionTable: v.string(),
  },
  handler: async (ctx, { inspectionId, sectionTable }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    if (!(await canAccessInspection(ctx, inspectionId))) return null;
    if (!isSectionTable(sectionTable)) return null;
    return await getSectionDoc(ctx, sectionTable, inspectionId);
  },
});

/** Crea o actualiza campos en una fila de sección (`data` debe coincidir con el schema de esa tabla). */
export const upsertSection = mutation({
  args: {
    inspectionId: v.id("inspections"),
    sectionTable: v.string(),
    data: v.any(),
  },
  handler: async (ctx, { inspectionId, sectionTable, data }) => {
    await requireAuth(ctx);
    if (!(await canAccessInspection(ctx, inspectionId))) {
      throw new Error("No autorizado");
    }
    if (!isSectionTable(sectionTable)) {
      throw new Error("Tabla de sección no válida");
    }
    const patch = data as Record<string, unknown>;
    const existing = await getSectionDoc(ctx, sectionTable, inspectionId);
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert(sectionTable, {
      inspectionId,
      ...patch,
    });
  },
});

/** URLs de miniaturas por clave de ítem (`itemPhotos` en el documento de sección). */
export const getSectionItemPhotoEntries = query({
  args: {
    inspectionId: v.id("inspections"),
    sectionTable: v.string(),
  },
  handler: async (ctx, { inspectionId, sectionTable }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {};
    if (!(await canAccessInspection(ctx, inspectionId))) return {};
    if (!isSectionTable(sectionTable)) return {};
    const doc = await getSectionDoc(ctx, sectionTable, inspectionId);
    if (!doc) return {};
    const raw = doc as unknown as Record<string, unknown>;
    const itemPhotos = raw.itemPhotos as
      | Record<string, Id<"_storage">[]>
      | undefined;
    if (!itemPhotos) return {};
    const out: Record<
      string,
      { storageId: Id<"_storage">; url: string | null }[]
    > = {};
    for (const [key, ids] of Object.entries(itemPhotos)) {
      out[key] = [];
      for (const sid of ids) {
        out[key].push({
          storageId: sid,
          url: await ctx.storage.getUrl(sid),
        });
      }
    }
    return out;
  },
});
