"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientId } from "@/lib/types/clientId";
import {
  createEmptyPendingInspectionRow,
  ensureClientIdOnRow,
  getDB,
  getOfflineDbMigrationDegraded,
  mergePendingInspectionDraftPatch,
  type PendingInspectionDraftPatch,
  type PendingInspectionRow,
} from "@/lib/offline/db";

const DEFAULT_DEBOUNCE_MS = 400;

export type UsePendingInspectionDraftOptions = {
  /** Debe coincidir con `keyPath` `localId`; invariante `localId === clientId`. */
  localId: ClientId;
  /** Debounce del wizard (texto); 300–500 ms recomendado. Por defecto 400. */
  debounceMs?: number;
};

export type UsePendingInspectionDraftResult = {
  row: PendingInspectionRow | null;
  loading: boolean;
  /** True si la migración IDB falló: no escribir; solo lectura de lo ya cargado. */
  readOnly: boolean;
  /**
   * Coalescer en un único `put` con el último estado: mergea `patch` en el borrador en memoria
   * y reinicia el temporizador de debounce (no encola múltiples puts concurrentes).
   */
  save: (patch: PendingInspectionDraftPatch) => void;
  /** Fuerza escritura inmediata (p. ej. tests o antes de navegar). Devuelve la promesa del `put`. */
  flush: () => Promise<void>;
};

/**
 * Borrador local con debounce y flush en `pagehide` / `visibilitychange`.
 *
 * - **Debounce:** coalescer merges y un solo `put` tras `debounceMs` sin nuevos `save`.
 * - **pagehide:** con `event.persisted === false` (pestaña que se cierra de verdad, no bfcache).
 * - **visibilitychange:** `document.visibilityState === "hidden"` como red de seguridad (iOS).
 * - En los handlers de lifecycle **no** se hace `await` del `put`: fire-and-forget (Safari puede matar la pestaña).
 *
 * **PR-C (Fase 2):** infraestructura aislada; la integración en wizard va en Fase 3 detrás de flag.
 * No cambia comportamiento observable hasta que un padre use este hook.
 */
export function usePendingInspectionDraft(
  options: UsePendingInspectionDraftOptions,
): UsePendingInspectionDraftResult {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const localKey = options.localId as string;

  const [row, setRow] = useState<PendingInspectionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);

  const draftRef = useRef<PendingInspectionRow | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readOnlyRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const putSnapshotFireAndForget = useCallback((snapshot: PendingInspectionRow) => {
    void getDB()
      .then((db) => db.put("pendingInspections", snapshot))
      .catch((err) => {
        console.error("[usePendingInspectionDraft] put (lifecycle)", err);
      });
  }, []);

  const flushImmediate = useCallback(async () => {
    clearTimer();
    if (readOnlyRef.current || !dirtyRef.current || !draftRef.current) return;
    const snapshot = draftRef.current;
    const db = await getDB();
    await db.put("pendingInspections", snapshot);
    dirtyRef.current = false;
    setRow(snapshot);
  }, [clearTimer]);

  const scheduleDebouncedWrite = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (readOnlyRef.current || !dirtyRef.current || !draftRef.current) return;
      void flushImmediate();
    }, debounceMs);
  }, [clearTimer, debounceMs, flushImmediate]);

  const save = useCallback(
    (patch: PendingInspectionDraftPatch) => {
      if (readOnlyRef.current || !draftRef.current) return;
      draftRef.current = mergePendingInspectionDraftPatch(draftRef.current, patch);
      dirtyRef.current = true;
      setRow(draftRef.current);
      scheduleDebouncedWrite();
    },
    [scheduleDebouncedWrite],
  );

  const flush = useCallback(async () => {
    await flushImmediate();
  }, [flushImmediate]);

  const flushLifecycleNoAwait = useCallback(() => {
    clearTimer();
    if (readOnlyRef.current || !dirtyRef.current || !draftRef.current) return;
    const snapshot = draftRef.current;
    dirtyRef.current = false;
    setRow(snapshot);
    putSnapshotFireAndForget(snapshot);
  }, [clearTimer, putSnapshotFireAndForget]);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const db = await getDB();
        if (getOfflineDbMigrationDegraded()) {
          if (!cancelled) {
            setReadOnly(true);
            readOnlyRef.current = true;
          }
        }
        let loaded = await db.get("pendingInspections", localKey);
        if (!loaded) {
          loaded = createEmptyPendingInspectionRow(localKey);
          if (!readOnlyRef.current) {
            await db.put("pendingInspections", loaded);
          }
        } else {
          loaded = ensureClientIdOnRow(loaded);
        }
        if (cancelled) return;
        draftRef.current = loaded;
        setRow(loaded);
      } catch (e) {
        console.error("[usePendingInspectionDraft] load", e);
        if (!cancelled) {
          setReadOnly(true);
          readOnlyRef.current = true;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [localKey, clearTimer]);

  useEffect(() => {
    const onPageHide = (ev: PageTransitionEvent) => {
      if (ev.persisted) return;
      flushLifecycleNoAwait();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushLifecycleNoAwait();
      }
    };
    globalThis.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      globalThis.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushLifecycleNoAwait]);

  return useMemo(
    () => ({
      row,
      loading,
      readOnly,
      save,
      flush,
    }),
    [row, loading, readOnly, save, flush],
  );
}
