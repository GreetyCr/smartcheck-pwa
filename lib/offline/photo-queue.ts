import { getDB, type PendingPhotoRow } from "@/lib/offline/db";

export type PhotoQueueRow = {
  id: string;
  inspectionId: string;
  sectionTable: string;
  itemKey: string;
  blob: Blob;
  createdAt: number;
};

const STORE = "pendingPhotos" as const;

export async function enqueuePhotoQueue(row: PhotoQueueRow): Promise<void> {
  const db = await getDB();
  const full: PendingPhotoRow = {
    id: row.id,
    inspectionLocalId: row.inspectionId,
    sectionTable: row.sectionTable,
    itemKey: row.itemKey,
    blob: row.blob,
    createdAt: row.createdAt,
    status: "pending",
  };
  await db.put(STORE, full);
}

export async function removePhotoQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function listPhotoQueueForSection(
  inspectionId: string,
  sectionTable: string,
): Promise<PhotoQueueRow[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex(
    STORE,
    "by-inspection",
    inspectionId,
  );
  return rows
    .filter((r) => r.sectionTable === sectionTable)
    .map((r) => ({
      id: r.id,
      inspectionId: r.inspectionLocalId,
      sectionTable: r.sectionTable,
      itemKey: r.itemKey,
      blob: r.blob,
      createdAt: r.createdAt,
    }));
}
