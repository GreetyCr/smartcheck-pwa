import type { FunctionArgs } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { uploadFileToConvexStorage } from "@/lib/convex-storage";
import {
  getDB,
  listInspectionRowsForSyncQueue,
  listPendingPhotosForInspection,
  patchPendingPhoto,
  putPendingInspectionRow,
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

export type ProcessSyncQueueOptions = {
  /** Reintentar filas en `error` (manual). Auto-sync debe usar `false`. */
  includeErrors?: boolean;
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
  storePhotos: PendingPhotoRow[],
): PendingPhotoRow[] {
  const byId = new Map<string, PendingPhotoRow>();
  for (const p of storePhotos) {
    if (p.status === "uploaded") continue;
    if (!(p.slot != null || p.sectionTable === "cabecera")) continue;
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

/** Fotos de cabecera ya subidas en intentos previos (reanudar sync parcial). */
function collectUploadedCabeceraManifest(
  storePhotos: PendingPhotoRow[],
): PhotoManifestEntry[] {
  const manifest: PhotoManifestEntry[] = [];
  for (const photo of storePhotos) {
    if (photo.status !== "uploaded" || !photo.storageId) continue;
    const slotRaw = photo.slot ?? photo.itemKey;
    if (!isCabeceraPhotoSlot(slotRaw)) continue;
    manifest.push({
      clientPhotoId: photo.id,
      storageId: photo.storageId as Id<"_storage">,
      slot: slotRaw,
    });
  }
  return manifest;
}

function mergePhotoManifests(
  existing: PhotoManifestEntry[],
  uploaded: PhotoManifestEntry[],
): PhotoManifestEntry[] {
  const bySlot = new Map<CabeceraPhotoSlot, PhotoManifestEntry>();
  for (const entry of existing) {
    bySlot.set(entry.slot, entry);
  }
  for (const entry of uploaded) {
    bySlot.set(entry.slot, entry);
  }
  return [...bySlot.values()];
}

async function uploadCabeceraPhotos(
  photos: PendingPhotoRow[],
  generateUploadUrl: () => Promise<string>,
): Promise<PhotoManifestEntry[]> {
  const manifest: PhotoManifestEntry[] = [];

  await mapPool(photos, SYNC_PHOTO_CONCURRENCY, async (photo) => {
    const slotRaw = photo.slot ?? photo.itemKey;
    if (!isCabeceraPhotoSlot(slotRaw)) {
      throw new Error(`Slot de cabecera inválido: ${slotRaw}`);
    }
    const slot = slotRaw as CabeceraPhotoSlot;

    if (photo.id) {
      await patchPendingPhoto(photo.id, { status: "uploading" });
    }

    try {
      const db = await getDB();
      const stored = photo.id
        ? await db.get("pendingPhotos", photo.id)
        : undefined;
      const blob = stored?.blob ?? photo.blob;
      if (!blob || blob.size === 0) {
        throw new Error(`Foto de cabecera ${slot} sin datos (${photo.id})`);
      }

      const postUrl = await generateUploadUrl();
      const file = blobToUploadFile(blob, photo.id);
      const storageId = await uploadFileToConvexStorage(postUrl, file);
      manifest.push({
        clientPhotoId: photo.id,
        storageId,
        slot,
      });
      if (photo.id) {
        await patchPendingPhoto(photo.id, {
          status: "uploaded",
          storageId,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (photo.id) {
        await patchPendingPhoto(photo.id, {
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
  const bySection = new Map<string, PendingPhotoRow[]>();
  for (const p of photos) {
    const list = bySection.get(p.sectionTable) ?? [];
    list.push(p);
    bySection.set(p.sectionTable, list);
  }

  for (const [sectionTable, sectionPhotos] of bySection) {
    const itemPhotos: Record<string, (Id<"_storage"> | string)[]> = {};
    for (const photo of sectionPhotos) {
      await patchPendingPhoto(photo.id, { status: "uploading" });
      try {
        const db = await getDB();
        const stored = await db.get("pendingPhotos", photo.id);
        const blob = stored?.blob ?? photo.blob;
        if (!blob || blob.size === 0) {
          throw new Error(`Foto de sección sin datos (${photo.id})`);
        }
        const postUrl = await adapters.generateUploadUrl();
        const file = blobToUploadFile(blob, photo.id);
        const storageId = await uploadFileToConvexStorage(postUrl, file);
        const list = itemPhotos[photo.itemKey] ?? [];
        list.push(storageId);
        itemPhotos[photo.itemKey] = list;
        await patchPendingPhoto(photo.id, {
          status: "uploaded",
          storageId,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await patchPendingPhoto(photo.id, {
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
  const cabeceraPhotos = collectCabeceraPhotos(storePhotos);
  const existingManifest = collectUploadedCabeceraManifest(storePhotos);

  let working: PendingInspectionRow = {
    ...row,
    syncStatus: "uploading",
    syncError: undefined,
  };
  await putPendingInspectionRow(working);

  const newManifest = await uploadCabeceraPhotos(
    cabeceraPhotos,
    adapters.generateUploadUrl,
  );
  const photoManifest = mergePhotoManifests(existingManifest, newManifest);

  working = { ...working, syncStatus: "syncing" };
  await putPendingInspectionRow(working);

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
  await putPendingInspectionRow(working);

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

  const done: PendingInspectionRow = {
    ...working,
    photos: [],
    syncStatus: "synced",
    syncError: undefined,
    syncedAt: Date.now(),
  };
  await putPendingInspectionRow(done);
}

/**
 * Cola local-first: inspección (Zod + photoManifest) → secciones → fotos de ítems.
 * Idempotente por `clientId` en Convex (PR-B).
 */
/**
 * Devuelve filas `uploading`/`syncing` a `pending` (p. ej. tras timeout o cierre abrupto).
 */
export async function recoverStuckSyncRows(): Promise<number> {
  const db = await getDB();
  const stuckStatuses: Array<PendingInspectionRow["syncStatus"]> = [
    "uploading",
    "syncing",
  ];
  let recovered = 0;
  for (const status of stuckStatuses) {
    const batch = await db.getAllFromIndex(
      "pendingInspections",
      "by-status",
      status,
    );
    for (const row of batch) {
      await putPendingInspectionRow({
        ...row,
        syncStatus: "pending",
        syncError: undefined,
      });
      recovered += 1;
    }
  }
  return recovered;
}

export async function processSyncQueue(
  adapters: SyncQueueAdapters,
  options: ProcessSyncQueueOptions = {},
): Promise<SyncQueueResult> {
  const includeErrors = options.includeErrors ?? true;
  const start = performance.now();
  const rows = await listInspectionRowsForSyncQueue();
  const queue = includeErrors
    ? rows
    : rows.filter((row) => row.syncStatus !== "error");
  let processed = 0;
  let errors = 0;
  let timedOut = false;

  for (const row of queue) {
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
      const failedRow = await db.get("pendingInspections", row.localId);
      await putPendingInspectionRow({
        ...(failedRow ?? row),
        syncStatus: "error",
        syncError: msg,
      });
      errors += 1;
    }
  }

  if (timedOut) {
    await recoverStuckSyncRows();
  }

  return { processed, errors, timedOut };
}
