import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { canAccessInspection, requireAdmin } from "./lib/auth";
import {
  getSectionDoc,
  SECTION_TABLE_ORDER,
  type SectionTable,
} from "./sections";

function visibleSectionTables(
  transmissionType: string | undefined,
): SectionTable[] {
  const tt = transmissionType ?? "";
  const is4wd = tt === "automatico_4wd" || tt === "manual_4wd";
  const all = [...SECTION_TABLE_ORDER];
  if (!is4wd) {
    return all.filter((t) => t !== "section_traccion");
  }
  return all;
}

/** Datos serializables para generar el PDF en el cliente (solo admin). */
export const getExportPayload = query({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, { inspectionId }) => {
    await requireAdmin(ctx);
    const inspection = await ctx.db.get(inspectionId);
    if (!inspection) throw new Error("Inspección no encontrada");

    const tables = visibleSectionTables(inspection.transmissionType);
    const sections: {
      table: string;
      doc: Record<string, unknown> | null;
      itemPhotoUrls: Record<string, string[]>;
      sectionPhotoUrls: string[];
    }[] = [];

    for (const table of tables) {
      const doc = await getSectionDoc(ctx, table, inspectionId);
      const plain = doc
        ? (JSON.parse(JSON.stringify(doc)) as Record<string, unknown>)
        : null;

      const itemPhotoUrls: Record<string, string[]> = {};
      const rawIp = plain?.itemPhotos as
        | Record<string, Id<"_storage">[]>
        | undefined;
      if (rawIp) {
        for (const [key, ids] of Object.entries(rawIp)) {
          const urls: string[] = [];
          for (const sid of ids) {
            const u = await ctx.storage.getUrl(sid);
            if (u) urls.push(u);
          }
          itemPhotoUrls[key] = urls;
        }
      }

      const sectionPhotoUrls: string[] = [];
      const rawPh = plain?.photos as Id<"_storage">[] | undefined;
      if (rawPh) {
        for (const sid of rawPh) {
          const u = await ctx.storage.getUrl(sid);
          if (u) sectionPhotoUrls.push(u);
        }
      }

      sections.push({
        table,
        doc: plain,
        itemPhotoUrls,
        sectionPhotoUrls,
      });
    }

    let vehiclePhotoUrl: string | null = null;
    let circulationCardUrl: string | null = null;
    if (inspection.vehiclePhoto) {
      vehiclePhotoUrl = await ctx.storage.getUrl(inspection.vehiclePhoto);
    }
    if (inspection.circulationCard) {
      circulationCardUrl = await ctx.storage.getUrl(inspection.circulationCard);
    }

    return {
      inspection: JSON.parse(JSON.stringify(inspection)) as Record<
        string,
        unknown
      >,
      sections,
      vehiclePhotoUrl,
      circulationCardUrl,
    };
  },
});

export const recordPdf = mutation({
  args: {
    inspectionId: v.id("inspections"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);
    if (!(await canAccessInspection(ctx, args.inspectionId))) {
      throw new Error("No autorizado");
    }
    return await ctx.db.insert("pdfs", {
      inspectionId: args.inspectionId,
      storageId: args.storageId,
      generatedAt: Date.now(),
      generatedBy: user._id,
      fileName: args.fileName,
      fileSize: args.fileSize,
    });
  },
});

/** Último PDF de una inspección (técnicos y admin con acceso). */
export const getLatestForInspection = query({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, { inspectionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    if (!(await canAccessInspection(ctx, inspectionId))) return null;

    const rows = await ctx.db
      .query("pdfs")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", inspectionId))
      .collect();
    if (rows.length === 0) return null;
    const latest = rows.reduce((a, b) =>
      a.generatedAt >= b.generatedAt ? a : b,
    );
    const url = await ctx.storage.getUrl(latest.storageId);
    return {
      fileName: latest.fileName,
      generatedAt: latest.generatedAt,
      url,
    };
  },
});

/** Estado de PDF para varias inspecciones (panel admin). */
export const getPdfStatusBatch = query({
  args: { inspectionIds: v.array(v.id("inspections")) },
  handler: async (ctx, { inspectionIds }) => {
    await requireAdmin(ctx);
    const out: Record<
      string,
      { url: string | null; generatedAt: number; fileName: string } | null
    > = {};
    for (const id of inspectionIds) {
      const rows = await ctx.db
        .query("pdfs")
        .withIndex("by_inspection", (q) => q.eq("inspectionId", id))
        .collect();
      const key = id as string;
      if (rows.length === 0) {
        out[key] = null;
        continue;
      }
      const latest = rows.reduce((a, b) =>
        a.generatedAt >= b.generatedAt ? a : b,
      );
      out[key] = {
        url: await ctx.storage.getUrl(latest.storageId),
        generatedAt: latest.generatedAt,
        fileName: latest.fileName,
      };
    }
    return out;
  },
});

/** Generar URL de subida para PDF (admin). */
export const generatePdfUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
