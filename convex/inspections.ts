import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  canAccessInspection,
  requireAdmin,
  requireUser,
  userHasFullAccess,
} from "./lib/auth";
import { SECTION_TABLE_ORDER } from "./sections";

/** Fire-and-forget hacia n8n (no bloquea la mutación). Desactivar con N8N_WEBHOOK_DISABLED=true. */
async function scheduleN8nNotify(
  ctx: MutationCtx,
  args: {
    event: string;
    inspectionId?: Id<"inspections">;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  if (process.env.N8N_WEBHOOK_DISABLED === "true") return;
  await ctx.scheduler.runAfter(0, internal.n8nWebhook.deliver, args);
}

const inspectionStatus = v.union(
  v.literal("draft"),
  v.literal("completed"),
  v.literal("pending_sync"),
  v.literal("synced"),
  v.literal("report_delivered"),
);

const countryOfOriginUnion = v.union(
  v.literal("usa"),
  v.literal("nacional"),
  v.literal("panama"),
  v.literal("korea"),
  v.literal("otros"),
);

const patchFields = v.object({
  clientName: v.optional(v.string()),
  clientPhone: v.optional(v.string()),
  clientEmail: v.optional(v.string()),
  location: v.optional(v.string()),
  sellerType: v.optional(
    v.union(v.literal("concesionaria"), v.literal("particular")),
  ),
  sellerNote: v.optional(v.string()),
  inspectionFee: v.optional(v.number()),
  outOfGamFee: v.optional(v.number()),
  captureSource: v.optional(
    v.union(
      v.literal("publicidad"),
      v.literal("tiktok"),
      v.literal("buscador"),
      v.literal("recompra"),
      v.literal("referido"),
    ),
  ),
  vehicleBrand: v.optional(v.string()),
  vehicleModel: v.optional(v.string()),
  vehicleYear: v.optional(v.number()),
  transmissionType: v.optional(
    v.union(
      v.literal("automatico_2wd"),
      v.literal("automatico_4wd"),
      v.literal("manual_2wd"),
      v.literal("manual_4wd"),
    ),
  ),
  engineType: v.optional(
    v.union(
      v.literal("gasolina"),
      v.literal("diesel"),
      v.literal("electrico"),
      v.literal("hibrido"),
    ),
  ),
  engineSpec: v.optional(v.string()),
  countryOfOrigin: v.optional(countryOfOriginUnion),
  identifierType: v.optional(v.union(v.literal("vin"), v.literal("placa"))),
  identifier: v.optional(v.string()),
  plateNumber: v.optional(v.string()),
  vin: v.optional(v.string()),
  mileage: v.optional(v.number()),
  mileageUnit: v.optional(v.union(v.literal("km"), v.literal("millas"))),
  vehiclePhoto: v.optional(v.id("_storage")),
  vehiclePhotoFront: v.optional(v.id("_storage")),
  vehiclePhotoSideLeft: v.optional(v.id("_storage")),
  vehiclePhotoSideRight: v.optional(v.id("_storage")),
  vehiclePhotoRear: v.optional(v.id("_storage")),
  circulationCard: v.optional(v.id("_storage")),
  photoDekra: v.optional(v.id("_storage")),
  photoPlate: v.optional(v.id("_storage")),
  platePhotoNote: v.optional(v.string()),
  photoMarchamo: v.optional(v.id("_storage")),
  photoVinSticker: v.optional(v.id("_storage")),
  status: v.optional(inspectionStatus),
  findingsCount: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
  reportDeliveredAt: v.optional(v.number()),
  biCommission: v.optional(v.union(v.literal("si"), v.literal("no"))),
  biVehicleCondition: v.optional(
    v.union(v.literal(1), v.literal(2), v.literal(3)),
  ),
});

function normalizeStatus(
  s:
    | "draft"
    | "completed"
    | "pending_sync"
    | "synced"
    | "report_delivered"
    | undefined,
):
  | "draft"
  | "completed"
  | "pending_sync"
  | "synced"
  | "report_delivered" {
  return s ?? "draft";
}

async function inspectionsForCurrentUser(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
  db: import("./_generated/server").QueryCtx["db"];
}): Promise<{ rows: Doc<"inspections">[]; isAdmin: boolean }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return { rows: [], isAdmin: false };

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (user?.role === "admin") {
    const rows = await ctx.db.query("inspections").order("desc").take(500);
    return { rows, isAdmin: true };
  }

  if (user && !userHasFullAccess(user)) {
    return { rows: [], isAdmin: false };
  }

  const rows = await ctx.db
    .query("inspections")
    .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
    .order("desc")
    .take(500);

  return { rows, isAdmin: false };
}

/** Crea borrador asociado al usuario autenticado (Clerk → JWT). */
export const createDraft = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const id = await ctx.db.insert("inspections", {
      clerkUserId: user.clerkId,
      status: "draft",
      findingsCount: 0,
    });
    await scheduleN8nNotify(ctx, {
      event: "inspection_created",
      inspectionId: id,
    });
    return id;
  },
});

/** URL temporal para subir un archivo a Convex Storage (p. ej. foto del vehículo). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Actualiza información general; requiere acceso a la inspección. */
export const patch = mutation({
  args: {
    id: v.id("inspections"),
    patch: patchFields,
  },
  handler: async (ctx, { id, patch }) => {
    const allowed = await canAccessInspection(ctx, id);
    if (!allowed) throw new Error("No autorizado");
    await ctx.db.patch(id, patch);
    await scheduleN8nNotify(ctx, {
      event: "inspection_patched",
      inspectionId: id,
      meta: { patchedKeys: Object.keys(patch) },
    });
  },
});

export const get = query({
  args: { id: v.id("inspections") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    const allowed = await canAccessInspection(ctx, id);
    if (!allowed) throw new Error("No autorizado");
    return await ctx.db.get(id);
  },
});

/** Inspección + URLs firmadas de fotos de cabecera (edición cliente/vehículo). */
export const getCabeceraEdit = query({
  args: { id: v.id("inspections") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    if (!(await canAccessInspection(ctx, id))) return null;
    const doc = await ctx.db.get(id);
    if (!doc) return null;

    const urlOf = async (ref: Id<"_storage"> | undefined) =>
      ref ? ((await ctx.storage.getUrl(ref)) ?? null) : null;

    return {
      inspection: doc,
      photoUrls: {
        front: await urlOf(doc.vehiclePhotoFront ?? doc.vehiclePhoto ?? undefined),
        sideLeft: await urlOf(doc.vehiclePhotoSideLeft ?? undefined),
        sideRight: await urlOf(doc.vehiclePhotoSideRight ?? undefined),
        rear: await urlOf(doc.vehiclePhotoRear ?? undefined),
        dekra: await urlOf(doc.photoDekra ?? undefined),
        plate: await urlOf(doc.photoPlate ?? undefined),
        marchamo: await urlOf(doc.photoMarchamo ?? undefined),
        vinSticker: await urlOf(doc.photoVinSticker ?? undefined),
      },
    };
  },
});

/**
 * Lista inspecciones del técnico (o todas si admin).
 * `refresh` solo invalida caché del cliente al cambiar.
 */
export const listByClerkUser = query({
  args: {
    status: v.optional(inspectionStatus),
    limit: v.optional(v.number()),
    refresh: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const { rows } = await inspectionsForCurrentUser(ctx);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    let filtered = rows;
    if (args.status !== undefined) {
      filtered = rows.filter((r) => {
        const s = normalizeStatus(r.status);
        if (args.status === "synced") {
          return s === "synced" || s === "report_delivered";
        }
        return s === args.status;
      });
    }

    return filtered.slice(0, limit);
  },
});

/** Búsqueda por placa, VIN o nombre de cliente (inspecciones del usuario). */
export const search = query({
  args: {
    query: v.string(),
    refresh: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const raw = args.query.trim().toLowerCase();
    if (!raw) return [];

    const { rows } = await inspectionsForCurrentUser(ctx);

    return rows.filter((doc) => {
      const plate = doc.identifier?.toLowerCase().trim() ?? "";
      const vin = doc.vin?.toLowerCase().trim() ?? "";
      const client = doc.clientName?.toLowerCase().trim() ?? "";
      return (
        plate.includes(raw) ||
        vin.includes(raw) ||
        client.includes(raw) ||
        (doc.identifierType === "placa" &&
          doc.identifier?.toLowerCase().includes(raw))
      );
    });
  },
});

/** Inspecciones con estado `pending_sync`. */
export const countPendingSync = query({
  args: { refresh: v.optional(v.number()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { count: 0, lastPendingAt: null as number | null };

    const { rows } = await inspectionsForCurrentUser(ctx);
    const pending = rows.filter((r) => r.status === "pending_sync");
    const lastPendingAt =
      pending.length > 0
        ? Math.max(...pending.map((p) => p._creationTime))
        : null;

    return { count: pending.length, lastPendingAt };
  },
});

/** IDs en cola de sincronización (para `flush` manual). */
export const listPendingSyncIds = query({
  args: { refresh: v.optional(v.number()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const { rows } = await inspectionsForCurrentUser(ctx);
    return rows
      .filter((r) => r.status === "pending_sync")
      .map((r) => r._id);
  },
});

/** Historial por placa (normalizada), más reciente primero. */
export const getVehicleHistory = query({
  args: {
    plate: v.string(),
    refresh: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const needle = args.plate.trim().toUpperCase().replace(/\s+/g, "");
    if (!needle) return [];

    const { rows } = await inspectionsForCurrentUser(ctx);

    return rows.filter((doc) => {
      const idType = doc.identifierType;
      const id = doc.identifier?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
      if (idType === "placa" && id === needle) return true;
      if (!idType && id === needle) return true;
      return false;
    });
  },
});

/** Admin: marca el informe PDF como entregado al cliente. */
export const markReportDelivered = mutation({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, { inspectionId }) => {
    await requireAdmin(ctx);
    const doc = await ctx.db.get(inspectionId);
    if (!doc) throw new Error("Inspección no encontrada");
    await ctx.db.patch(inspectionId, {
      status: "report_delivered",
      reportDeliveredAt: Date.now(),
    });
    await scheduleN8nNotify(ctx, {
      event: "report_delivered",
      inspectionId,
    });
  },
});

/** Marca inspección como sincronizada (p. ej. tras subir a la nube). */
export const markSynced = mutation({
  args: { id: v.id("inspections") },
  handler: async (ctx, { id }) => {
    const allowed = await canAccessInspection(ctx, id);
    if (!allowed) throw new Error("No autorizado");
    await ctx.db.patch(id, {
      status: "synced",
      lastSyncedAt: Date.now(),
    });
    await scheduleN8nNotify(ctx, {
      event: "inspection_marked_synced",
      inspectionId: id,
    });
  },
});

/** Elimina un borrador y sus filas de sección. */
export const removeDraft = mutation({
  args: { id: v.id("inspections") },
  handler: async (ctx, { id }) => {
    const allowed = await canAccessInspection(ctx, id);
    if (!allowed) throw new Error("No autorizado");
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("No encontrado");
    const st = normalizeStatus(doc.status);
    if (st !== "draft") {
      throw new Error("Solo se pueden eliminar borradores");
    }

    for (const table of SECTION_TABLE_ORDER) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_inspection", (q) => q.eq("inspectionId", id))
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }

    await ctx.db.delete(id);
  },
});

/** Duplica cabecera de inspección como nuevo borrador (sin secciones). */
export const duplicateInspection = mutation({
  args: { sourceId: v.id("inspections") },
  handler: async (ctx, { sourceId }) => {
    const allowed = await canAccessInspection(ctx, sourceId);
    if (!allowed) throw new Error("No autorizado");
    const src = await ctx.db.get(sourceId);
    if (!src) throw new Error("No encontrado");
    const user = await requireUser(ctx);

    const newId = await ctx.db.insert("inspections", {
      clerkUserId: user.clerkId,
      status: "draft",
      findingsCount: 0,
      clientName: src.clientName,
      clientPhone: src.clientPhone,
      clientEmail: src.clientEmail,
      location: src.location,
      sellerType: src.sellerType,
      sellerNote: src.sellerNote,
      inspectionFee: src.inspectionFee,
      outOfGamFee: src.outOfGamFee,
      captureSource: src.captureSource,
      vehicleBrand: src.vehicleBrand,
      vehicleModel: src.vehicleModel,
      vehicleYear: src.vehicleYear,
      transmissionType: src.transmissionType,
      engineType: src.engineType,
      engineSpec: src.engineSpec,
      countryOfOrigin: src.countryOfOrigin,
      identifierType: src.identifierType,
      identifier: src.identifier,
      plateNumber: src.plateNumber,
      vin: src.vin,
      mileage: src.mileage,
      mileageUnit: src.mileageUnit,
    });
    await scheduleN8nNotify(ctx, {
      event: "inspection_duplicated",
      inspectionId: newId,
      meta: { sourceInspectionId: sourceId },
    });
    return newId;
  },
});
