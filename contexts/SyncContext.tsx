"use client";

import { useMutation } from "convex/react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { countPendingInspections } from "@/lib/offline/db";
import { syncPendingToConvex } from "@/lib/offline/sync";
import { processSyncQueue } from "@/lib/offline/syncQueue";

type SyncContextValue = {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncNow: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const POLL_MS = 5000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

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
    const n = await countPendingInspections();
    setPendingCount(n);
  }, []);

  useEffect(() => {
    void refreshPendingCount();
    const t = setInterval(() => {
      void refreshPendingCount();
    }, POLL_MS);
    return () => clearInterval(t);
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

  const syncNow = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const queueResult = await processSyncQueue({
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
      });

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
      setIsSyncing(false);
    }
  }, [
    createDraft,
    patch,
    ensureSectionRows,
    upsertSection,
    markSynced,
    generateUploadUrl,
    createOrUpdateFromDraft,
    isSyncing,
    refreshPendingCount,
  ]);

  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      void syncNow();
    }
  }, [isOnline, pendingCount, isSyncing, syncNow]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && isOnline && pendingCount > 0) {
        void syncNow();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isOnline, pendingCount, syncNow]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        pendingCount,
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
