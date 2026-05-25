import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { SECTIONS_CONFIG } from "@/lib/constants/sectionItems";
import { canAccessInspection, requireUser } from "./lib/auth";
import { normalizeStoredPhotoUrl } from "./lib/externalPhotoUrl";
import { sanitizeSectionPatch } from "./lib/sanitizeSectionPatch";
import { countFindingsForSectionDoc } from "@/lib/inspection-findings";

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

/** Ítems del catálogo por tabla — una sola fuente de verdad con `SECTIONS_CONFIG`. */
const SECTION_ITEM_TOTALS: Record<SectionTable, number> = Object.fromEntries(
  SECTION_TABLE_ORDER.map((table) => {
    const cfg = SECTIONS_CONFIG.find((s) => s.table === table);
    return [table, cfg?.items.length ?? 0];
  }),
) as Record<SectionTable, number>;

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

    const inspection = await ctx.db.get(inspectionId);
    if (!inspection) return null;

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
      const findings = countFindingsForSectionDoc(table, plain);
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
    await requireUser(ctx);
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
    await requireUser(ctx);
    const allowed = await canAccessInspection(ctx, inspectionId);
    if (!allowed) throw new Error("No autorizado");
    const doc = await ctx.db.get(inspectionId);
    if (!doc) throw new Error("No encontrado");
    if (
      doc.reportDeliveredAt != null ||
      doc.status === "report_delivered"
    ) {
      return;
    }
    await ctx.db.patch(inspectionId, { status: "draft" });
  },
});

export const discardInspection = mutation({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, { inspectionId }) => {
    await requireUser(ctx);
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
    await requireUser(ctx);
    if (!(await canAccessInspection(ctx, inspectionId))) {
      throw new Error("No autorizado");
    }
    if (!isSectionTable(sectionTable)) {
      throw new Error("Tabla de sección no válida");
    }
    const patch = sanitizeSectionPatch(data as Record<string, unknown>);
    const existing = await getSectionDoc(ctx, sectionTable, inspectionId);
    if (existing && patch.itemPhotos && typeof patch.itemPhotos === "object") {
      const prevRaw = (existing as unknown as Record<string, unknown>).itemPhotos;
      const prev =
        prevRaw &&
        typeof prevRaw === "object" &&
        !Array.isArray(prevRaw)
          ? (prevRaw as Record<string, (Id<"_storage"> | string)[]>)
          : {};
      patch.itemPhotos = {
        ...prev,
        ...(patch.itemPhotos as Record<string, (Id<"_storage"> | string)[]>),
      };
    }
    if (existing) {
      if (Object.keys(patch).length === 0) {
        return existing._id;
      }
      try {
        await ctx.db.patch(existing._id, patch);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(
          `No se pudo guardar la sección (${sectionTable}): ${msg}`,
        );
      }
      return existing._id;
    }
    try {
      return await ctx.db.insert(sectionTable, {
        inspectionId,
        ...patch,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `No se pudo crear la sección (${sectionTable}): ${msg}`,
      );
    }
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
      | Record<string, (Id<"_storage"> | string)[]>
      | undefined;
    if (!itemPhotos) return {};
    const out: Record<
      string,
      { ref: string; url: string | null }[]
    > = {};
    for (const [key, refs] of Object.entries(itemPhotos)) {
      out[key] = [];
      for (const ref of refs) {
        if (typeof ref === "string") {
          const ext = normalizeStoredPhotoUrl(ref);
          if (ext) {
            out[key].push({ ref, url: ext });
          } else {
            const sid = ref as Id<"_storage">;
            out[key].push({
              ref: sid,
              url: await ctx.storage.getUrl(sid),
            });
          }
        }
      }
    }
    return out;
  },
});
