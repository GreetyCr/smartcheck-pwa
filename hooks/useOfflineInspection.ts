"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSync } from "@/contexts/SyncContext";
import {
  getDB,
  putPendingInspectionRow,
  type InspectionData,
  type SectionData,
  type PendingInspectionRow,
} from "@/lib/offline/db";
import { loadPendingInspectionRowByRef } from "@/lib/inspection/resolveInspectionRef";
import { looksLikeConvexInspectionId } from "@/lib/inspection/idValidation";

type Options = {
  inspectionId?: string;
  /**
   * Flujo unificado (PR-E2): id Convex para `get` cuando ya está resuelto.
   * `undefined` = inferir como hoy; `null` = no consultar Convex.
   */
  convexInspectionIdForOnline?: Id<"inspections"> | null;
};

/**
 * Abstrae guardado y lectura de inspección online (Convex) / offline (IndexedDB).
 * RF-17, RF-18, RF-19.
 */
export function useOfflineInspection({
  inspectionId,
  convexInspectionIdForOnline,
}: Options) {
  const { isOnline, refreshPendingCount, pendingCount } = useSync();
  const [localRow, setLocalRow] = useState<PendingInspectionRow | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(false);

  const createDraft = useMutation(api.inspections.createDraft);
  const patchM = useMutation(api.inspections.patch);
  const upsertSectionM = useMutation(api.sections.upsertSection);
  const ensureSectionRowsM = useMutation(api.sections.ensureSectionRows);

  useEffect(() => {
    if (!inspectionId) {
      setLocalRow(null);
      return;
    }
    setLoadingLocal(true);
    void (async () => {
      try {
        const db = await getDB();
        let row: PendingInspectionRow | undefined = await db.get(
          "pendingInspections",
          inspectionId,
        );
        if (!row) {
          const all = await db.getAll("pendingInspections");
          row = all.find(
            (r) =>
              r.convexId === inspectionId ||
              String(r.clientId ?? "") === inspectionId ||
              r.localId === inspectionId,
          );
        }
        setLocalRow(row ?? null);
      } finally {
        setLoadingLocal(false);
      }
    })();
  }, [inspectionId, isOnline, pendingCount]);

  const queryId = useMemo((): Id<"inspections"> | null => {
    if (convexInspectionIdForOnline !== undefined) {
      if (convexInspectionIdForOnline === null) return null;
      if (localRow && localRow.syncStatus !== "synced" && !isOnline) {
        return null;
      }
      return convexInspectionIdForOnline;
    }
    if (!isOnline) return null;
    if (localRow) {
      if (localRow.convexId) return localRow.convexId as Id<"inspections">;
      return null;
    }
    if (inspectionId && looksLikeConvexInspectionId(inspectionId)) {
      return inspectionId as Id<"inspections">;
    }
    return null;
  }, [isOnline, localRow, inspectionId, convexInspectionIdForOnline]);

  const convexInspection = useQuery(
    api.inspections.get,
    queryId ? { id: queryId } : "skip",
  );

  const inspection = !isOnline
    ? (localRow?.data ?? null)
    : localRow && !localRow.convexId
      ? (localRow.data as InspectionData)
      : convexInspection ?? (localRow?.data ?? null);

  const sections = !isOnline ? (localRow?.sections ?? null) : null;

  const saveInspection = useCallback(
    async (data: InspectionData) => {
      if (isOnline) {
        if (inspectionId) {
          const id =
            (localRow?.convexId as Id<"inspections"> | undefined) ||
            (inspectionId as Id<"inspections">);
          await patchM({ id, patch: data });
          if (localRow) {
            const next = { ...localRow, data, updatedAt: Date.now() };
            await putPendingInspectionRow(next);
            setLocalRow(next);
          }
        } else {
          const newId = await createDraft();
          if (data && Object.keys(data).length > 0) {
            await patchM({ id: newId, patch: data });
          }
          await ensureSectionRowsM({ inspectionId: newId });
          return newId;
        }
      } else {
        const db = await getDB();
        const localId = inspectionId || crypto.randomUUID();
        const prev = await db.get("pendingInspections", localId);
        const now = Date.now();
        const next: PendingInspectionRow = {
          localId,
          convexId: prev?.convexId,
          data: { ...prev?.data, ...data },
          sections: prev?.sections ?? {},
          photos: prev?.photos ?? [],
          createdAt: prev?.createdAt ?? now,
          updatedAt: now,
          syncStatus: "pending",
        };
        await putPendingInspectionRow(next);
        setLocalRow(next);
        void refreshPendingCount();
        return localId;
      }
    },
    [
      isOnline,
      inspectionId,
      localRow,
      createDraft,
      patchM,
      ensureSectionRowsM,
      refreshPendingCount,
    ],
  );

  const saveSection = useCallback(
    async (sectionTable: string, sectionData: SectionData) => {
      if (!inspectionId) return;
      const row = await loadPendingInspectionRowByRef(inspectionId);
      if (!row) return;

      const convexTarget =
        convexInspectionIdForOnline !== null && convexInspectionIdForOnline !== undefined
          ? convexInspectionIdForOnline
          : row.convexId
            ? (row.convexId as Id<"inspections">)
            : undefined;

      if (isOnline && convexTarget) {
        await upsertSectionM({
          inspectionId: convexTarget,
          sectionTable,
          data: sectionData,
        });
      }

      const next: PendingInspectionRow = {
        ...row,
        sections: { ...row.sections, [sectionTable]: sectionData },
        updatedAt: Date.now(),
        syncStatus: row.syncStatus === "synced" ? "synced" : "pending",
      };
      await putPendingInspectionRow(next);
      setLocalRow(next);
      void refreshPendingCount();
    },
    [
      isOnline,
      inspectionId,
      convexInspectionIdForOnline,
      upsertSectionM,
      refreshPendingCount,
    ],
  );

  return {
    isOnline,
    isLoading: loadingLocal,
    inspection: inspection as typeof convexInspection,
    /** Solo en offline: mapa de secciones locales. */
    sections,
    localRow,
    saveInspection,
    saveSection,
    /** True si el registro local aún no subió. */
    pendingSync: localRow?.syncStatus === "pending",
  };
}
