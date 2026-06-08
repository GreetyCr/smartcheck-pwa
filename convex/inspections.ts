import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  canAccessInspection,
  canAccessInspectionByClientId,
  inspectionByClientId,
  requireAdmin,
  requireUser,
  userHasFullAccess,
} from "./lib/auth";
import { SECTION_TABLE_ORDER } from "./sections";
import { validateInspectionDraftPatch } from "./lib/validateInspectionDraft";
import { applyCommissionPatchSideEffects } from "./lib/commission";

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

const photoManifestSlot = v.union(
  v.literal("vehicleFront"),
  v.literal("vehicleSideLeft"),
  v.literal("vehicleSideRight"),
  v.literal("vehicleRear"),
  v.literal("dekra"),
  v.literal("plate"),
  v.literal("marchamo"),
  v.literal("vinSticker"),
);

const photoManifestEntry = v.object({
  clientPhotoId: v.string(),
  storageId: v.id("_storage"),
  slot: photoManifestSlot,
});

const CABECERA_SLOT_TO_PATCH: Record<
  string,
  | "vehiclePhotoFront"
  | "vehiclePhotoSideLeft"
  | "vehiclePhotoSideRight"
  | "vehiclePhotoRear"
  | "photoDekra"
  | "photoPlate"
  | "photoMarchamo"
  | "photoVinSticker"
> = {
  vehicleFront: "vehiclePhotoFront",
  vehicleSideLeft: "vehiclePhotoSideLeft",
  vehicleSideRight: "vehiclePhotoSideRight",
  vehicleRear: "vehiclePhotoRear",
  dekra: "photoDekra",
  plate: "photoPlate",
  marchamo: "photoMarchamo",
  vinSticker: "photoVinSticker",
};

function applyPhotoManifestToPayload(
  payload: Record<string, unknown>,
  manifest: { slot: string; storageId: Id<"_storage"> }[] | undefined,
): Record<string, unknown> {
  if (!manifest?.length) return payload;
  const next = { ...payload };
  for (const item of manifest) {
    const field = CABECERA_SLOT_TO_PATCH[item.slot];
    if (!field) continue;
    next[field] = item.storageId;
    if (item.slot === "vehicleFront") {
      next.vehiclePhoto = item.storageId;
    }
  }
  return next;
}

/**
 * Keys aceptadas en `patchFields` — mantener alineadas con
 * `INSPECTION_DRAFT_PATCH_FIELD_KEYS` en `lib/validation/inspectionDraft.ts`.
 */
export const INSPECTION_PATCH_FIELD_KEYS = [
  "clientId",
  "clientName",
  "clientPhone",
  "clientEmail",
  "location",
  "sellerType",
  "sellerNote",
  "inspectionFee",
  "outOfGamFee",
  "inGam",
  "manychatId",
  "totalAmountCharged",
  "captureSource",
  "vehicleBrand",
  "vehicleModel",
  "vehicleYear",
  "transmissionType",
  "engineType",
  "engineSpec",
  "countryOfOrigin",
  "identifierType",
  "identifier",
  "plateNumber",
  "vin",
  "mileage",
  "mileageUnit",
  "vehiclePhoto",
  "vehiclePhotoFront",
  "vehiclePhotoSideLeft",
  "vehiclePhotoSideRight",
  "vehiclePhotoRear",
  "circulationCard",
  "photoDekra",
  "photoPlate",
  "platePhotoNote",
  "photoMarchamo",
  "photoVinSticker",
  "status",
  "findingsCount",
  "lastSyncedAt",
  "reportDeliveredAt",
  "biCommission",
  "biVehicleCondition",
] as const;

const patchFields = v.object({
  clientId: v.optional(v.string()),
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
  inGam: v.optional(v.union(v.literal("si"), v.literal("no"))),
  manychatId: v.optional(v.string()),
  totalAmountCharged: v.optional(v.number()),
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
      v.literal("gas_lp"),
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
      totalAmountCharged: 0,
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
    const enriched = applyCommissionPatchSideEffects(
      patch as Record<string, unknown>,
    );
    await ctx.db.patch(id, enriched);
    await scheduleN8nNotify(ctx, {
      event: "inspection_patched",
      inspectionId: id,
      meta: { patchedKeys: Object.keys(enriched) },
    });
  },
});

/** Quita `undefined` para no borrar campos en `db.patch` por accidente. */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
}

/**
 * Crea o actualiza una inspección por `clientId` (idempotente en una sola mutación).
 * `photoManifest` mapea blobs ya subidos a Storage → campos de cabecera por `slot`.
 *
 * Convex no garantiza unicidad declarativa de `clientId`: el patrón es leer por índice
 * `by_client_id` y luego insert o patch en esta misma mutación; reintentos concurrentes
 * con el mismo UUID son improbables; si ocurrieran, el cliente debe reintentar.
 */
export const createOrUpdateFromDraft = mutation({
  args: {
    clientId: v.string(),
    payload: patchFields,
    photoManifest: v.optional(v.array(photoManifestEntry)),
  },
  returns: v.object({
    inspectionId: v.id("inspections"),
    created: v.boolean(),
  }),
  handler: async (ctx, { clientId, payload, photoManifest }) => {
    const trimmed = clientId.trim();
    if (!trimmed) throw new Error("clientId inválido");

    const validatedPayload = validateInspectionDraftPatch(payload);
    const withPhotos = applyPhotoManifestToPayload(
      validatedPayload as Record<string, unknown>,
      photoManifest,
    );

    const user = await requireUser(ctx);
    const existing = await inspectionByClientId(ctx, trimmed);

    if (existing) {
      if (!(await canAccessInspectionByClientId(ctx, trimmed))) {
        throw new Error("No autorizado");
      }
      const withCommission = applyCommissionPatchSideEffects(withPhotos);
      const clean = omitUndefined({
        ...withCommission,
        clientId: trimmed,
      }) as Record<string, unknown>;
      await ctx.db.patch(existing._id, clean);
      await scheduleN8nNotify(ctx, {
        event: "inspection_patched",
        inspectionId: existing._id,
        meta: { patchedKeys: Object.keys(clean), clientId: trimmed },
      });
      return { inspectionId: existing._id, created: false };
    }

    const insertPayload = applyCommissionPatchSideEffects(
      omitUndefined(withPhotos) as Record<string, unknown>,
    );
    const id = await ctx.db.insert("inspections", {
      ...insertPayload,
      clerkUserId: user.clerkId,
      clientId: trimmed,
      status: "draft",
      findingsCount: 0,
      totalAmountCharged: 0,
    });
    await scheduleN8nNotify(ctx, {
      event: "inspection_created",
      inspectionId: id,
      meta: { clientId: trimmed },
    });
    return { inspectionId: id, created: true };
  },
});

export const get = query({
  args: { id: v.id("inspections") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return null;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    const allowed = await canAccessInspection(ctx, id);
    if (!allowed) throw new Error("No autorizado");
    return doc;
  },
});

/** Inspección por `clientId` estable (local-first). `null` si no existe o sin acceso. */
export const getByClientId = query({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    if (!(await canAccessInspectionByClientId(ctx, clientId))) return null;
    return await inspectionByClientId(ctx, clientId);
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
  args: {
    inspectionId: v.id("inspections"),
    manychatId: v.optional(v.string()),
  },
  handler: async (ctx, { inspectionId, manychatId }) => {
    await requireAdmin(ctx);
    const doc = await ctx.db.get(inspectionId);
    if (!doc) throw new Error("Inspección no encontrada");
    const trimmedManychat = manychatId?.trim();
    await ctx.db.patch(inspectionId, {
      status: "report_delivered",
      reportDeliveredAt: Date.now(),
      ...(trimmedManychat ? { manychatId: trimmedManychat } : {}),
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
      inGam: src.inGam,
      captureSource: src.captureSource,
      totalAmountCharged: 0,
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
