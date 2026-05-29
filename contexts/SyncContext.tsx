"use client";

import { useMutation } from "convex/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { countAutoSyncPendingInspections, countPendingInspections, normalizeEmbeddedInspectionPhotos } from "@/lib/offline/db";
import { runRetentionSweep } from "@/lib/offline/retention";
import { syncPendingToConvex } from "@/lib/offline/sync";
import { processSyncQueue, recoverStuckSyncRows } from "@/lib/offline/syncQueue";

type SyncContextValue = {
  isOnline: boolean;
  pendingCount: number;
  autoSyncCount: number;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncNow: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const POLL_MS = 5000;
/** Mínimo entre intentos automáticos (evita loop rápido si la fila no avanza). */
const AUTO_SYNC_COOLDOWN_MS = 12_000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [autoSyncCount, setAutoSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const isSyncingRef = useRef(false);
  const lastAutoSyncAtRef = useRef(0);
  const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createDraft = useMutation(api.inspections.createDraft);
  const patch = useMutation(api.inspections.patch);
  const ensureSectionRows = useMutation(api.sections.ensureSectionRows);
  const upsertSection = useMutation(api.sections.upsertSection);
  const markSynced = useMutation(api.inspections.markSynced);
  const generateUploadUrl = useMutation(api.inspections.generateUploadUrl);
  const createOrUpdateFromDraft = useMutation(
    api.inspections.createOrUpdateFromDraft,
  );

  const refreshPendingCount = useCallback(async () => {
    const [n, auto] = await Promise.all([
      countPendingInspections(),
      countAutoSyncPendingInspections(),
    ]);
    setPendingCount(n);
    setAutoSyncCount(auto);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [recovered, normalized] = await Promise.all([
          recoverStuckSyncRows(),
          normalizeEmbeddedInspectionPhotos(),
        ]);
        if (recovered > 0 || normalized > 0) {
          await refreshPendingCount();
        }
      } catch (e) {
        console.error("[smartcheck sync recover]", e);
      }
    })();
  }, [refreshPendingCount]);

  useEffect(() => {
    void refreshPendingCount();
    const t = setInterval(() => {
      void refreshPendingCount();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refreshPendingCount]);

  useEffect(() => {
    void runRetentionSweep()
      .then((result) => {
        if (result.rowsDeleted > 0 || result.rowsTrimmed > 0) {
          void refreshPendingCount();
        }
      })
      .catch((e) => {
        console.error("[smartcheck retention]", e);
      });
  }, [refreshPendingCount]);

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" && navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    globalThis.addEventListener("online", on);
    globalThis.addEventListener("offline", off);
    return () => {
      globalThis.removeEventListener("online", on);
      globalThis.removeEventListener("offline", off);
    };
  }, []);

  const runSync = useCallback(
    async (options: { includeErrors: boolean }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (isSyncingRef.current) return;

      isSyncingRef.current = true;
      setIsSyncing(true);
      try {
        const queueResult = await processSyncQueue(
          {
            generateUploadUrl: () => generateUploadUrl(),
            createOrUpdateFromDraft: (args) => createOrUpdateFromDraft(args),
            ensureSectionRows: async (a) => {
              await ensureSectionRows(a);
            },
            upsertSection: async (a) => {
              await upsertSection(a);
            },
            markSynced: async (a) => {
              await markSynced(a);
            },
          },
          { includeErrors: options.includeErrors },
        );

        const legacyResult = await syncPendingToConvex({
          createDraft: () => createDraft(),
          patch: async (args) => {
            await patch({ id: args.id, patch: args.patch });
          },
          ensureSectionRows: async (a) => {
            await ensureSectionRows(a);
          },
          upsertSection: async (a) => {
            await upsertSection(a);
          },
          markSynced: async (a) => {
            await markSynced(a);
          },
        });

        const anyOk =
          queueResult.processed > 0 ||
          legacyResult.ok > 0 ||
          (!queueResult.timedOut && !legacyResult.timedOut);
        if (anyOk) {
          setLastSyncAt(new Date());
        }
        await refreshPendingCount();
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [
      createDraft,
      patch,
      ensureSectionRows,
      upsertSection,
      markSynced,
      generateUploadUrl,
      createOrUpdateFromDraft,
      refreshPendingCount,
    ],
  );

  const syncNow = useCallback(async () => {
    await runSync({ includeErrors: true });
  }, [runSync]);

  const scheduleAutoSync = useCallback(() => {
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }

    const elapsed = Date.now() - lastAutoSyncAtRef.current;
    const delay =
      elapsed >= AUTO_SYNC_COOLDOWN_MS
        ? 0
        : AUTO_SYNC_COOLDOWN_MS - elapsed;

    autoSyncTimerRef.current = setTimeout(() => {
      autoSyncTimerRef.current = null;
      if (isSyncingRef.current) return;
      lastAutoSyncAtRef.current = Date.now();
      void runSync({ includeErrors: false });
    }, delay);
  }, [runSync]);

  useEffect(() => {
    if (!isOnline || autoSyncCount <= 0 || isSyncingRef.current) return;
    scheduleAutoSync();
    return () => {
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
  }, [isOnline, autoSyncCount, scheduleAutoSync]);

  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        isOnline &&
        autoSyncCount > 0 &&
        !isSyncingRef.current
      ) {
        scheduleAutoSync();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isOnline, autoSyncCount, scheduleAutoSync]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        pendingCount,
        autoSyncCount,
        isSyncing,
        lastSyncAt,
        syncNow,
        refreshPendingCount,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}
