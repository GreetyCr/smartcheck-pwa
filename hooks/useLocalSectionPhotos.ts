"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_PHOTOS_PER_ITEM } from "@/lib/constants/photos";
import {
  compressImageOrFallback,
  isImageLikeFile,
  withImageMimeForUpload,
} from "@/lib/images";
import {
  enqueuePhotoQueue,
  listPhotoQueueForSection,
  removePhotoQueue,
} from "@/lib/offline/photo-queue";
import type { PhotoEntry } from "@/components/inspection/items/ItemPhotos";

export type LocalQueuedPhoto = {
  id: string;
  itemKey: string;
  previewUrl: string;
};

type Options = {
  inspectionLocalId: string;
  sectionTable: string;
  maxPerItem?: number;
  getSavedPhotoCount: (itemKey: string) => number;
  /** Ref local (UUID en `pendingPhotos`) añadida al estado del formulario. */
  onPhotoRef: (itemKey: string, ref: string) => void;
};

/**
 * Fotos de ítems en modo local-first: solo IndexedDB (`pendingPhotos`), sin UploadThing.
 * La cola unificada (`processSyncQueue`) sube los blobs al sincronizar.
 */
export function useLocalSectionPhotos({
  inspectionLocalId,
  sectionTable,
  maxPerItem = MAX_PHOTOS_PER_ITEM,
  getSavedPhotoCount,
  onPhotoRef,
}: Options) {
  const [pendingByItem, setPendingByItem] = useState<
    Record<string, LocalQueuedPhoto[]>
  >({});
  const onPhotoRefRef = useRef(onPhotoRef);
  onPhotoRefRef.current = onPhotoRef;
  const getSavedRef = useRef(getSavedPhotoCount);
  getSavedRef.current = getSavedPhotoCount;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await listPhotoQueueForSection(
        inspectionLocalId,
        sectionTable,
      );
      if (!rows.length || cancelled) return;
      const grouped: Record<string, LocalQueuedPhoto[]> = {};
      for (const row of rows) {
        const previewUrl = URL.createObjectURL(row.blob);
        grouped[row.itemKey] = [
          ...(grouped[row.itemKey] ?? []),
          { id: row.id, itemKey: row.itemKey, previewUrl },
        ];
      }
      setPendingByItem((prev) => {
        const merged = { ...prev };
        for (const k of Object.keys(grouped)) {
          const incoming = grouped[k]!;
          const existing = merged[k] ?? [];
          const ids = new Set(existing.map((p) => p.id));
          const add = incoming.filter((p) => !ids.has(p.id));
          merged[k] = [...existing, ...add];
        }
        return merged;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [inspectionLocalId, sectionTable]);

  const removePhotoLocal = useCallback((id: string) => {
    setPendingByItem((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        const list = next[key];
        const found = list.find((p) => p.id === id);
        if (found) {
          URL.revokeObjectURL(found.previewUrl);
          next[key] = list.filter((p) => p.id !== id);
          if (next[key].length === 0) delete next[key];
          return next;
        }
      }
      return prev;
    });
  }, []);

  const addPhotosForItem = useCallback(
    async (itemKey: string, files: File[]) => {
      const compressed: File[] = [];
      for (const f of files) {
        if (!isImageLikeFile(f)) continue;
        compressed.push(
          withImageMimeForUpload(
            await compressImageOrFallback(f, {
              maxWidth: 1200,
              maxHeight: 1200,
              quality: 0.8,
            }),
          ),
        );
      }
      if (!compressed.length) return;

      const pendingForKey = pendingByItem[itemKey]?.length ?? 0;
      const saved = getSavedRef.current(itemKey);
      const slots = maxPerItem - saved - pendingForKey;
      if (slots <= 0) return;

      const slice = compressed.slice(0, slots);
      const newEntries: LocalQueuedPhoto[] = [];

      for (const file of slice) {
        const id = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);
        await enqueuePhotoQueue({
          id,
          inspectionId: inspectionLocalId,
          sectionTable,
          itemKey,
          blob: file,
          createdAt: Date.now(),
        });
        newEntries.push({ id, itemKey, previewUrl });
        onPhotoRefRef.current(itemKey, id);
      }

      setPendingByItem((prev) => ({
        ...prev,
        [itemKey]: [...(prev[itemKey] ?? []), ...newEntries],
      }));
    },
    [inspectionLocalId, maxPerItem, pendingByItem, sectionTable],
  );

  const removePendingPhoto = useCallback(
    async (itemKey: string, id: string) => {
      const list = pendingByItem[itemKey];
      if (!list?.some((p) => p.id === id)) return;
      await removePhotoQueue(id).catch(() => {});
      removePhotoLocal(id);
    },
    [pendingByItem, removePhotoLocal],
  );

  const pendingForItem = useCallback(
    (itemKey: string) => pendingByItem[itemKey] ?? [],
    [pendingByItem],
  );

  const photoEntriesForItem = useCallback(
    (itemKey: string): PhotoEntry[] =>
      pendingForItem(itemKey).map((p) => ({
        ref: p.id,
        url: p.previewUrl,
        status: "done",
      })),
    [pendingForItem],
  );

  const stats = useMemo(
    () => ({ pending: 0, uploading: 0, error: 0, active: 0 }),
    [],
  );

  const awaitUploadsIdle = useCallback(async () => undefined, []);

  return {
    addPhotosForItem,
    removePendingPhoto,
    pendingForItem,
    photoEntriesForItem,
    stats,
    awaitUploadsIdle,
  };
}
