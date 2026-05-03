"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const LAST_SYNC_KEY = "smartcheck_last_sync_at";

function getLs(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } | null {
  const g = globalThis as unknown as {
    localStorage?: {
      getItem: (k: string) => string | null;
      setItem: (k: string, v: string) => void;
    };
  };
  return g.localStorage ?? null;
}

function readLastSyncAt(): number | null {
  const ls = getLs();
  if (!ls) return null;
  const raw = ls.getItem(LAST_SYNC_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatRelativeMinutes(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

/**
 * Cola de sincronización: inspecciones `pending_sync` en Convex + última sync manual (local).
 */
export function useSyncQueue() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  useEffect(() => {
    setLastSyncAt(readLastSyncAt());
  }, []);

  const pendingInfo = useQuery(api.inspections.countPendingSync, {});
  const pendingIds = useQuery(api.inspections.listPendingSyncIds, {});
  const markSynced = useMutation(api.inspections.markSynced);

  const pendingCount = pendingInfo?.count ?? 0;

  const lastSyncLabel = useMemo(() => {
    if (pendingInfo?.lastPendingAt && pendingCount > 0) {
      return `Última pendiente ${formatRelativeMinutes(pendingInfo.lastPendingAt)}`;
    }
    if (lastSyncAt) {
      return `Última sync ${formatRelativeMinutes(lastSyncAt)}`;
    }
    return "Última hace —";
  }, [lastSyncAt, pendingCount, pendingInfo?.lastPendingAt]);

  const flush = useCallback(async () => {
    if (pendingIds === undefined) return;
    if (pendingIds.length === 0) {
      const now = Date.now();
      getLs()?.setItem(LAST_SYNC_KEY, String(now));
      setLastSyncAt(now);
      return;
    }
    setIsSyncing(true);
    try {
      for (const id of pendingIds) {
        await markSynced({ id });
      }
      const now = Date.now();
      getLs()?.setItem(LAST_SYNC_KEY, String(now));
      setLastSyncAt(now);
    } finally {
      setIsSyncing(false);
    }
  }, [markSynced, pendingIds]);

  return {
    pendingCount,
    lastSyncAt,
    lastSyncLabel,
    isSyncing,
    flush,
  };
}
