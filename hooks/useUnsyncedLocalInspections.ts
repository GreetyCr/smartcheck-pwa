"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { useSync } from "@/contexts/SyncContext";
import {
  listUnsyncedInspections,
  type PendingInspectionRow,
} from "@/lib/offline/db";

export function useUnsyncedLocalInspections() {
  const { pendingCount, isSyncing } = useSync();
  const [rows, setRows] = useState<PendingInspectionRow[]>([]);

  const reload = useCallback(async () => {
    const next = await listUnsyncedInspections();
    setRows(next);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, pendingCount, isSyncing]);

  const statusByRef = useMemo(() => {
    const map = new Map<string, PendingInspectionRow["syncStatus"]>();
    for (const row of rows) {
      map.set(row.localId, row.syncStatus);
      if (row.clientId) map.set(String(row.clientId), row.syncStatus);
      if (row.convexId) map.set(row.convexId, row.syncStatus);
    }
    return map;
  }, [rows]);

  const localSyncStatusForConvex = useCallback(
    (inspection: Doc<"inspections">): PendingInspectionRow["syncStatus"] | undefined => {
      const byId = statusByRef.get(inspection._id);
      if (byId) return byId;
      if (inspection.clientId) {
        const byClient = statusByRef.get(inspection.clientId);
        if (byClient) return byClient;
      }
      return undefined;
    },
    [statusByRef],
  );

  const localOnlyRows = useMemo(() => {
    return rows.filter((row) => {
      if (row.convexId) {
        return false;
      }
      return true;
    });
  }, [rows]);

  const pendingInSyncQueue = useCallback(
    (inspection: Doc<"inspections">): boolean => {
      const st = localSyncStatusForConvex(inspection);
      return st !== undefined && st !== "synced";
    },
    [localSyncStatusForConvex],
  );

  return {
    unsyncedRows: rows,
    localOnlyRows,
    reload,
    localSyncStatusForConvex,
    pendingInSyncQueue,
  };
}
