import { getDB, type PendingPhotoRow } from "@/lib/offline/db";

const PLACEHOLDER_JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], {
  type: "image/jpeg",
});

/** Re-lee bytes del blob (Safari invalida referencias en IDB tras un rato). */
export async function rehydratePhotoBlob(blob: Blob): Promise<Blob> {
  if (blob.size === 0) {
    throw new Error("La foto local está vacía.");
  }
  try {
    const buf = await blob.arrayBuffer();
    if (buf.byteLength === 0) {
      throw new Error("La foto local está vacía.");
    }
    return new Blob([buf], { type: blob.type || "image/jpeg" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo leer la foto guardada: ${msg}`);
  }
}

export async function putPendingPhotoRow(row: PendingPhotoRow): Promise<void> {
  const db = await getDB();
  const blob = await rehydratePhotoBlob(row.blob);
  await db.put("pendingPhotos", { ...row, blob });
}

export async function deletePendingPhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("pendingPhotos", id);
}

/**
 * Actualiza metadatos de foto sin re-serializar un blob inválido.
 * Tras `uploaded` elimina la fila (ya está en Convex Storage).
 */
export async function patchPendingPhoto(
  id: string,
  patch: Partial<Omit<PendingPhotoRow, "id">>,
): Promise<void> {
  if (patch.status === "uploaded") {
    await deletePendingPhoto(id);
    return;
  }

  const db = await getDB();
  const existing = await db.get("pendingPhotos", id);
  if (!existing) return;

  if (patch.status === "error") {
    await db.put("pendingPhotos", {
      id: existing.id,
      inspectionLocalId: existing.inspectionLocalId,
      sectionTable: existing.sectionTable,
      itemKey: existing.itemKey,
      slot: existing.slot,
      blob: PLACEHOLDER_JPEG,
      createdAt: existing.createdAt,
      status: "error",
      syncError: patch.syncError ?? existing.syncError,
      storageId: existing.storageId,
    });
    return;
  }

  if (patch.status === "uploading") {
    return;
  }

  const blob = patch.blob
    ? await rehydratePhotoBlob(patch.blob)
    : await rehydratePhotoBlob(existing.blob);
  await db.put("pendingPhotos", { ...existing, ...patch, blob });
}
