import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  canAccessInspection,
  requireAdmin,
  requireUser,
} from "./lib/auth";
import { normalizeStoredPhotoUrl } from "./lib/externalPhotoUrl";
import {
  getSectionDoc,
  SECTION_TABLE_ORDER,
  type SectionTable,
} from "./sections";

/** Todas las tablas de sección del reporte (incluye Tracción). */
function visibleSectionTables(_transmissionType: string | undefined): SectionTable[] {
  return [...SECTION_TABLE_ORDER];
}

/** Datos serializables para generar el PDF en el cliente (admin o técnico con acceso). */
export const getExportPayload = query({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, { inspectionId }) => {
    await requireUser(ctx);
    if (!(await canAccessInspection(ctx, inspectionId))) {
      throw new Error("No autorizado");
    }
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
        | Record<string, (Id<"_storage"> | string)[]>
        | undefined;
      if (rawIp) {
        for (const [key, refs] of Object.entries(rawIp)) {
          const urls: string[] = [];
          for (const ref of refs) {
            if (typeof ref === "string") {
              const ext = normalizeStoredPhotoUrl(ref);
              if (ext) {
                urls.push(ext);
              } else {
                const u = await ctx.storage.getUrl(ref as Id<"_storage">);
                if (u) urls.push(u);
              }
            }
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

    const storageUrl = async (
      ref: Id<"_storage"> | undefined,
    ): Promise<string | null> => {
      if (!ref) return null;
      return (await ctx.storage.getUrl(ref)) ?? null;
    };

    const frontRef =
      inspection.vehiclePhotoFront ?? inspection.vehiclePhoto ?? undefined;
    const vehiclePhotoUrl = await storageUrl(frontRef);

    const vehicleAnglePhotoUrls = {
      front: await storageUrl(
        inspection.vehiclePhotoFront ?? inspection.vehiclePhoto ?? undefined,
      ),
      sideLeft: await storageUrl(inspection.vehiclePhotoSideLeft ?? undefined),
      sideRight: await storageUrl(inspection.vehiclePhotoSideRight ?? undefined),
      rear: await storageUrl(inspection.vehiclePhotoRear ?? undefined),
    };

    const extraVehiclePhotoUrls = {
      dekra: await storageUrl(inspection.photoDekra ?? undefined),
      plate: await storageUrl(inspection.photoPlate ?? undefined),
      marchamo: await storageUrl(inspection.photoMarchamo ?? undefined),
      vinSticker: await storageUrl(inspection.photoVinSticker ?? undefined),
    };

    const circulationCardUrl = await storageUrl(
      inspection.circulationCard ?? undefined,
    );

    return {
      inspection: JSON.parse(JSON.stringify(inspection)) as Record<
        string,
        unknown
      >,
      sections,
      vehiclePhotoUrl,
      circulationCardUrl,
      vehicleAnglePhotoUrls,
      extraVehiclePhotoUrls,
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
    const user = await requireUser(ctx);
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

/** Generar URL de subida para PDF (admin o técnico aprobado). */
export const generatePdfUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
