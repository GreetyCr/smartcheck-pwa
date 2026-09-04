"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { MAX_PHOTOS_PER_ITEM } from "@/lib/constants/photos";
import {
  compressImageOrFallback,
  isImageLikeFile,
  withImageMimeForUpload,
} from "@/lib/images";
import {
  listPhotoQueueForSection,
  removePhotoQueue,
} from "@/lib/offline/photo-queue";
import { useUploadThing } from "@/lib/uploadthing";
import { normalizePublicPhotoUrl } from "@/lib/photoUrls";

export type QueuedItemPhoto = {
  id: string;
  itemKey: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "error";
  errorMessage?: string;
};

function extractUploadedUrl(res: unknown): string | undefined {
  if (!Array.isArray(res) || res.length === 0) return undefined;
  const first = res[0] as Record<string, unknown>;
  let raw: string | undefined;
  if (typeof first.ufsUrl === "string") raw = first.ufsUrl;
  else if (typeof first.url === "string") raw = first.url;
  const sd = first.serverData;
  if (!raw && sd && typeof sd === "object" && "url" in sd) {
    const u = (sd as { url?: string }).url;
    if (typeof u === "string") raw = u;
  }
  if (!raw?.trim()) return undefined;
  return normalizePublicPhotoUrl(raw);
}

type UsePhotoUploadOptions = {
  inspectionId: Id<"inspections">;
  sectionTable: string;
  maxPerItem?: number;
  getSavedPhotoCount: (itemKey: string) => number;
  onPhotoUrl: (itemKey: string, url: string) => void;
};

export function usePhotoUpload({
  inspectionId,
  sectionTable,
  maxPerItem = MAX_PHOTOS_PER_ITEM,
  getSavedPhotoCount,
  onPhotoUrl,
}: UsePhotoUploadOptions) {
  const { startUpload } = useUploadThing("inspectionPhoto", {
    onUploadError: (e: Error) => {
      const detail =
        e && typeof e === "object" && "cause" in e
          ? String((e as { cause?: unknown }).cause)
          : "";
      console.error("[uploadthing]", e?.message ?? e, detail || "");
    },
  });

  const [pendingByItem, setPendingByItem] = useState<
    Record<string, QueuedItemPhoto[]>
  >({});
  const onPhotoUrlRef = useRef(onPhotoUrl);
  onPhotoUrlRef.current = onPhotoUrl;
  const getSavedRef = useRef(getSavedPhotoCount);
  getSavedRef.current = getSavedPhotoCount;
  const pendingByItemRef = useRef(pendingByItem);
  useEffect(() => {
    pendingByItemRef.current = pendingByItem;
  }, [pendingByItem]);
  const drainingRef = useRef(false);

  const updatePhoto = useCallback(
    (
      id: string,
      patch: Partial<Pick<QueuedItemPhoto, "status" | "errorMessage">>,
    ) => {
      setPendingByItem((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          const list = next[key];
          const idx = list.findIndex((p) => p.id === id);
          if (idx >= 0) {
            const copy = [...list];
            copy[idx] = { ...copy[idx], ...patch };
            next[key] = copy;
            return next;
          }
        }
        return prev;
      });
    },
    [],
  );

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

  const runUpload = useCallback(
    async (photo: QueuedItemPhoto) => {
      const maxAttempts = 3;
      let lastErr: unknown;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          await new Promise((r) =>
            globalThis.setTimeout(r, 400 * attempt),
          );
        }
        updatePhoto(photo.id, { status: "uploading", errorMessage: undefined });
        try {
          const res = await startUpload([photo.file]);
          const url = extractUploadedUrl(res);
          if (!url) throw new Error("Respuesta sin URL");
          onPhotoUrlRef.current(photo.itemKey, url);
          await removePhotoQueue(photo.id).catch(() => {});
          removePhotoLocal(photo.id);
          return;
        } catch (e) {
          lastErr = e;
        }
      }
      const msg =
        lastErr instanceof Error ? lastErr.message : String(lastErr);
      updatePhoto(photo.id, { status: "error", errorMessage: msg });
    },
    [removePhotoLocal, startUpload, updatePhoto],
  );

  const drainPending = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      const flat = Object.values(pendingByItemRef.current).flat();
      const toRun = flat.filter((p) => p.status === "pending");
      for (const p of toRun) {
        await runUpload(p);
      }
    } finally {
      drainingRef.current = false;
    }
  }, [runUpload]);

  useEffect(() => {
    const onOnline = () => {
      void drainPending();
    };
    globalThis.addEventListener("online", onOnline);
    return () => globalThis.removeEventListener("online", onOnline);
  }, [drainPending]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await listPhotoQueueForSection(
        inspectionId,
        sectionTable,
      );
      if (!rows.length || cancelled) return;
      const grouped: Record<string, QueuedItemPhoto[]> = {};
      for (const row of rows) {
        const file = new File([row.blob], "photo.jpg", {
          type: row.blob.type || "image/jpeg",
        });
        const previewUrl = URL.createObjectURL(file);
        grouped[row.itemKey] = [
          ...(grouped[row.itemKey] ?? []),
          {
            id: row.id,
            itemKey: row.itemKey,
            file,
            previewUrl,
            status: "pending",
          },
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
      queueMicrotask(() => {
        void drainPending();
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drainPending solo en microtask; no re-fetch IDB al cambiar drainPending
  }, [inspectionId, sectionTable]);

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
      if (!compressed.length) {
        console.warn(
          "[usePhotoUpload] No hay imágenes válidas (MIME vacío o archivo no soportado).",
        );
        return;
      }

      const pendingForKey =
        pendingByItemRef.current[itemKey]?.length ?? 0;
      const saved = getSavedRef.current(itemKey);
      const slots = maxPerItem - saved - pendingForKey;
      if (slots <= 0) return;

      const slice = compressed.slice(0, slots);
      const newEntries: QueuedItemPhoto[] = [];

      for (const file of slice) {
        const id = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);
        newEntries.push({
          id,
          itemKey,
          file,
          previewUrl,
          status: "pending",
        });
      }

      setPendingByItem((prev) => ({
        ...prev,
        [itemKey]: [...(prev[itemKey] ?? []), ...newEntries],
      }));

      await Promise.all(newEntries.map((entry) => runUpload(entry)));
    },
    // `inspectionId`/`sectionTable` no se leen acá; entran igual por
    // `runUpload`, así que como dependencias solo recreaban el callback de más.
    [maxPerItem, runUpload],
  );

  /** Espera a que no queden fotos en cola (p. ej. antes de guardar y navegar). */
  const awaitUploadsIdle = useCallback(async (timeoutMs = 90_000) => {
    const start = Date.now();
    return new Promise<void>((resolve, reject) => {
      const tick = () => {
        const flat = Object.values(pendingByItemRef.current).flat();
        const busy = flat.some(
          (p) => p.status === "pending" || p.status === "uploading",
        );
        if (!busy) {
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(
            new Error(
              "Las fotos tardaron demasiado en subir. Comprueba la red e inténtalo de nuevo.",
            ),
          );
          return;
        }
        globalThis.setTimeout(tick, 120);
      };
      tick();
    });
  }, []);

  const removePendingPhoto = useCallback(
    async (itemKey: string, id: string) => {
      const list = pendingByItemRef.current[itemKey];
      const hit = list?.find((p) => p.id === id);
      if (!hit) return;
      await removePhotoQueue(id).catch(() => {});
      removePhotoLocal(id);
    },
    [removePhotoLocal],
  );

  const stats = useMemo(() => {
    let pending = 0;
    let uploading = 0;
    let err = 0;
    for (const list of Object.values(pendingByItem)) {
      for (const p of list) {
        if (p.status === "pending") pending++;
        else if (p.status === "uploading") uploading++;
        else if (p.status === "error") err++;
      }
    }
    return { pending, uploading, error: err, active: pending + uploading };
  }, [pendingByItem]);

  const pendingForItem = useCallback(
    (itemKey: string) => pendingByItem[itemKey] ?? [],
    [pendingByItem],
  );

  return {
    addPhotosForItem,
    removePendingPhoto,
    pendingForItem,
    pendingByItem,
    stats,
    awaitUploadsIdle,
  };
}
