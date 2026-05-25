import type { FunctionArgs } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { uploadFileToConvexStorage } from "@/lib/convex-storage";
import {
  getDB,
  listInspectionRowsForSyncQueue,
  listPendingPhotosForInspection,
  type PendingInspectionRow,
  type PendingPhotoRow,
  type SectionData,
} from "@/lib/offline/db";
import {
  isCabeceraPhotoSlot,
  type CabeceraPhotoSlot,
  type PhotoManifestEntry,
} from "@/lib/offline/photoSlots";
import { safeParseInspectionDraftPatch } from "@/lib/validation/inspectionDraft";

export type CreateOrUpdateFromDraftArgs = FunctionArgs<
  typeof api.inspections.createOrUpdateFromDraft
>;

export type SyncQueueAdapters = {
  generateUploadUrl: () => Promise<string>;
  createOrUpdateFromDraft: (
    args: CreateOrUpdateFromDraftArgs,
  ) => Promise<{ inspectionId: Id<"inspections">; created: boolean }>;
  ensureSectionRows: (args: {
    inspectionId: Id<"inspections">;
  }) => Promise<void>;
  upsertSection: (args: {
    inspectionId: Id<"inspections">;
    sectionTable: string;
    data: SectionData;
  }) => Promise<void>;
  markSynced: (args: { id: Id<"inspections"> }) => Promise<void>;
};

export type SyncQueueResult = {
  processed: number;
  errors: number;
  timedOut: boolean;
};

export const SYNC_QUEUE_MAX_MS = 28_000;
export const SYNC_PHOTO_CONCURRENCY = 4;
const BACKOFF_BASE_MS = 800;

function blobToUploadFile(blob: Blob, id: string): File {
  const ext = blob.type === "image/png" ? "png" : "jpg";
  return new File([blob], `${id}.${ext}`, {
    type: blob.type || "image/jpeg",
  });
}

function jitteredBackoffMs(attempt: number): number {
  const exp = Math.min(BACKOFF_BASE_MS * 2 ** attempt, 12_000);
  return exp * (0.85 + Math.random() * 0.3);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Ejecuta tareas con límite de concurrencia. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]!);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function resolveClientId(row: PendingInspectionRow): string {
  return String(row.clientId ?? row.localId).trim();
}

function collectCabeceraPhotos(
  row: PendingInspectionRow,
  storePhotos: PendingPhotoRow[],
): PendingPhotoRow[] {
  const embedded = row.photos.filter(
    (p) =>
      p.status !== "uploaded" &&
      (p.slot != null || p.sectionTable === "cabecera"),
  );
  const fromStore = storePhotos.filter(
    (p) =>
      p.status !== "uploaded" &&
      (p.slot != null || p.sectionTable === "cabecera"),
  );
  const byId = new Map<string, PendingPhotoRow>();
  for (const p of [...embedded, ...fromStore]) {
    byId.set(p.id, p);
  }
  return [...byId.values()];
}

function collectSectionPhotos(storePhotos: PendingPhotoRow[]): PendingPhotoRow[] {
  return storePhotos.filter(
    (p) =>
      p.status !== "uploaded" &&
      p.sectionTable !== "cabecera" &&
      !p.slot &&
      p.sectionTable.length > 0,
  );
}

async function uploadCabeceraPhotos(
  photos: PendingPhotoRow[],
  generateUploadUrl: () => Promise<string>,
): Promise<PhotoManifestEntry[]> {
  const manifest: PhotoManifestEntry[] = [];
  const db = await getDB();

  await mapPool(photos, SYNC_PHOTO_CONCURRENCY, async (photo) => {
    const slotRaw = photo.slot ?? photo.itemKey;
    if (!isCabeceraPhotoSlot(slotRaw)) {
      throw new Error(`Slot de cabecera inválido: ${slotRaw}`);
    }
    const slot = slotRaw as CabeceraPhotoSlot;

    if (photo.id) {
      await db.put("pendingPhotos", { ...photo, status: "uploading" });
    }

    try {
      const postUrl = await generateUploadUrl();
      const file = blobToUploadFile(photo.blob, photo.id);
      const storageId = await uploadFileToConvexStorage(postUrl, file);
      manifest.push({
        clientPhotoId: photo.id,
        storageId,
        slot,
      });
      if (photo.id) {
        await db.put("pendingPhotos", {
          ...photo,
          status: "uploaded",
          storageId,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (photo.id) {
        await db.put("pendingPhotos", {
          ...photo,
          status: "error",
          syncError: msg,
        });
      }
      throw e;
    }
  });

  return manifest;
}

async function uploadSectionPhotos(
  photos: PendingPhotoRow[],
  inspectionId: Id<"inspections">,
  adapters: Pick<SyncQueueAdapters, "generateUploadUrl" | "upsertSection">,
): Promise<void> {
  if (photos.length === 0) return;
  const db = await getDB();
  const bySection = new Map<string, PendingPhotoRow[]>();
  for (const p of photos) {
    const list = bySection.get(p.sectionTable) ?? [];
    list.push(p);
    bySection.set(p.sectionTable, list);
  }

  for (const [sectionTable, sectionPhotos] of bySection) {
    const itemPhotos: Record<string, (Id<"_storage"> | string)[]> = {};
    for (const photo of sectionPhotos) {
      const uploading: PendingPhotoRow = { ...photo, status: "uploading" };
      await db.put("pendingPhotos", uploading);
      try {
        const postUrl = await adapters.generateUploadUrl();
        const file = blobToUploadFile(photo.blob, photo.id);
        const storageId = await uploadFileToConvexStorage(postUrl, file);
        const list = itemPhotos[photo.itemKey] ?? [];
        list.push(storageId);
        itemPhotos[photo.itemKey] = list;
        await db.put("pendingPhotos", {
          ...photo,
          status: "uploaded",
          storageId,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await db.put("pendingPhotos", {
          ...photo,
          status: "error",
          syncError: msg,
        });
        throw e;
      }
    }
    if (Object.keys(itemPhotos).length > 0) {
      await adapters.upsertSection({
        inspectionId,
        sectionTable,
        data: { itemPhotos },
      });
    }
  }
}

async function syncOneRow(
  row: PendingInspectionRow,
  adapters: SyncQueueAdapters,
  attempt: number,
): Promise<void> {
  if (attempt > 0) {
    await sleep(jitteredBackoffMs(attempt - 1));
  }

  const db = await getDB();
  const clientId = resolveClientId(row);
  if (!clientId) {
    throw new Error("Fila IDB sin clientId");
  }

  const storePhotos = await listPendingPhotosForInspection(row.localId);
  const cabeceraPhotos = collectCabeceraPhotos(row, storePhotos);

  let working: PendingInspectionRow = {
    ...row,
    syncStatus: "uploading",
    syncError: undefined,
  };
  await db.put("pendingInspections", working);

  const photoManifest = await uploadCabeceraPhotos(
    cabeceraPhotos,
    adapters.generateUploadUrl,
  );

  working = { ...working, syncStatus: "syncing" };
  await db.put("pendingInspections", working);

  const parsed = safeParseInspectionDraftPatch(working.data);
  if (!parsed.success) {
    throw new Error(
      `Payload local inválido: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  const { inspectionId } = await adapters.createOrUpdateFromDraft({
    clientId,
    payload: parsed.data as CreateOrUpdateFromDraftArgs["payload"],
    photoManifest: photoManifest.length > 0 ? photoManifest : undefined,
  });

  working = { ...working, convexId: inspectionId };
  await db.put("pendingInspections", working);

  await adapters.ensureSectionRows({ inspectionId });

  for (const [sectionTable, sectionData] of Object.entries(working.sections)) {
    if (sectionData && typeof sectionData === "object") {
      await adapters.upsertSection({
        inspectionId,
        sectionTable,
        data: sectionData as SectionData,
      });
    }
  }

  const sectionPhotos = collectSectionPhotos(storePhotos);
  await uploadSectionPhotos(sectionPhotos, inspectionId, adapters);

  await adapters.markSynced({ id: inspectionId });

  const uploadedIds = new Set(photoManifest.map((m) => m.clientPhotoId));
  const updatedPhotos = working.photos.map((p) =>
    uploadedIds.has(p.id)
      ? { ...p, status: "uploaded" as const }
      : p,
  );

  const done: PendingInspectionRow = {
    ...working,
    photos: updatedPhotos,
    syncStatus: "synced",
    syncError: undefined,
    syncedAt: Date.now(),
  };
  await db.put("pendingInspections", done);
}

/**
 * Cola local-first: inspección (Zod + photoManifest) → secciones → fotos de ítems.
 * Idempotente por `clientId` en Convex (PR-B).
 */
export async function processSyncQueue(
  adapters: SyncQueueAdapters,
): Promise<SyncQueueResult> {
  const start = performance.now();
  const rows = await listInspectionRowsForSyncQueue();
  let processed = 0;
  let errors = 0;
  let timedOut = false;

  for (const row of rows) {
    if (performance.now() - start > SYNC_QUEUE_MAX_MS) {
      timedOut = true;
      break;
    }
    const attempt = row.syncStatus === "error" ? 1 : 0;
    try {
      await syncOneRow(row, adapters, attempt);
      processed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const db = await getDB();
      await db.put("pendingInspections", {
        ...row,
        syncStatus: "error",
        syncError: msg,
      });
      errors += 1;
    }
  }

  return { processed, errors, timedOut };
}
