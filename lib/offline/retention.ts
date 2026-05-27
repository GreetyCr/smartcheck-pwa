import {
  getDB,
  listPendingPhotosForInspection,
  type InspectionData,
  type PendingInspectionRow,
} from "@/lib/offline/db";

const DAY_MS = 86_400_000;

/** Tras sync exitosa: eliminar wizard, secciones locales y blobs de fotos. */
export const WIZARD_PURGE_BLOBS_AFTER_SYNC_DAYS = 7;

/** Conservar fila con metadatos ligeros; luego borrar la fila completa. */
export const LOCAL_ROW_METADATA_RETENTION_DAYS = 30;

const LIGHT_DATA_KEYS = [
  "clientId",
  "identifier",
  "plateNumber",
  "clientName",
  "clientPhone",
  "vehicleBrand",
  "vehicleModel",
  "vehicleYear",
  "status",
] as const;

export type RetentionSweepResult = {
  scanned: number;
  blobsPurged: number;
  rowsTrimmed: number;
  rowsDeleted: number;
};

function daysToMs(days: number): number {
  return days * DAY_MS;
}

function retentionReferenceAt(row: PendingInspectionRow): number {
  return row.syncedAt ?? row.updatedAt;
}

function pickLightMetadata(data: InspectionData): InspectionData {
  const out: InspectionData = {};
  for (const key of LIGHT_DATA_KEYS) {
    const value = data[key];
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function rowHasHeavyPayload(row: PendingInspectionRow): boolean {
  if (row.wizard !== undefined && Object.keys(row.wizard).length > 0) {
    return true;
  }
  if (Object.keys(row.sections).length > 0) return true;
  if (row.photos.length > 0) return true;
  return false;
}

async function deletePendingPhotosForInspection(
  inspectionLocalId: string,
): Promise<number> {
  const db = await getDB();
  const photos = await listPendingPhotosForInspection(inspectionLocalId);
  if (photos.length === 0) return 0;
  const tx = db.transaction("pendingPhotos", "readwrite");
  for (const photo of photos) {
    await tx.store.delete(photo.id);
  }
  await tx.done;
  return photos.length;
}

function trimRowToLightMetadata(
  row: PendingInspectionRow,
): PendingInspectionRow {
  return {
    localId: row.localId,
    clientId: row.clientId,
    convexId: row.convexId,
    data: pickLightMetadata(row.data),
    sections: {},
    photos: [],
    wizard: undefined,
    createdAt: row.createdAt,
    updatedAt: Date.now(),
    syncStatus: "synced",
    syncError: undefined,
    syncedAt: row.syncedAt ?? row.updatedAt,
  };
}

/**
 * Purga datos pesados de filas ya sincronizadas y elimina filas antiguas.
 * Idempotente: seguro invocar en cada boot.
 */
export async function runRetentionSweep(
  now = Date.now(),
): Promise<RetentionSweepResult> {
  const db = await getDB();
  const synced = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "synced",
  );

  const purgeBlobCutoff = now - daysToMs(WIZARD_PURGE_BLOBS_AFTER_SYNC_DAYS);
  const deleteRowCutoff = now - daysToMs(LOCAL_ROW_METADATA_RETENTION_DAYS);

  let blobsPurged = 0;
  let rowsTrimmed = 0;
  let rowsDeleted = 0;

  for (const row of synced) {
    const refAt = retentionReferenceAt(row);

    if (refAt < deleteRowCutoff) {
      const removedPhotos = await deletePendingPhotosForInspection(row.localId);
      blobsPurged += removedPhotos;
      await db.delete("pendingInspections", row.localId);
      rowsDeleted += 1;
      continue;
    }

    if (refAt >= purgeBlobCutoff) continue;

    const pendingPhotos = await listPendingPhotosForInspection(row.localId);
    const needsTrim = rowHasHeavyPayload(row) || pendingPhotos.length > 0;

    if (!needsTrim) continue;

    const removedPhotos = await deletePendingPhotosForInspection(row.localId);
    blobsPurged += removedPhotos;

    const trimmed = trimRowToLightMetadata(row);
    await db.put("pendingInspections", trimmed);
    rowsTrimmed += 1;
  }

  return {
    scanned: synced.length,
    blobsPurged,
    rowsTrimmed,
    rowsDeleted,
  };
}
