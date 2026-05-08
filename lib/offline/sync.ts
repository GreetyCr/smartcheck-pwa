import type { Id } from "@/convex/_generated/dataModel";
import {
  getDB,
  type InspectionData,
  type PendingInspectionRow,
} from "@/lib/offline/db";

const MAX_SYNC_MS = 28_000; /** RNF-07: &lt; 30 s (margen de red) */

export type SyncAdapters = {
  createDraft: () => Promise<Id<"inspections">>;
  patch: (args: { id: Id<"inspections">; patch: InspectionData }) => Promise<void>;
  ensureSectionRows: (args: {
    inspectionId: Id<"inspections">;
  }) => Promise<void>;
  upsertSection: (args: {
    inspectionId: Id<"inspections">;
    sectionTable: string;
    data: unknown;
  }) => Promise<void>;
  markSynced: (args: { id: Id<"inspections"> }) => Promise<void>;
};

export type SyncResult = {
  ok: number;
  errors: number;
  /** Si se cortó el tiempo límite de sincronización. */
  timedOut: boolean;
};

/**
 * Sincroniza inspecciones pendientes hacia Convex (RF-19).
 * Asegura filas de sección y sube parches y secciones; marca `markSynced` al final.
 */
export async function syncPendingToConvex(
  adapters: SyncAdapters,
): Promise<SyncResult> {
  const start = performance.now();
  const db = await getDB();
  const pending = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "pending",
  );
  const errored = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "error",
  );
  const toProcess = [...pending, ...errored];
  let ok = 0;
  let errors = 0;
  let timedOut = false;

  for (const inspection of toProcess) {
    if (performance.now() - start > MAX_SYNC_MS) {
      timedOut = true;
      break;
    }
    const row: PendingInspectionRow = { ...inspection };
    row.syncStatus = "syncing";
    row.syncError = undefined;
    await db.put("pendingInspections", row);

    try {
      let convexId = row.convexId as Id<"inspections"> | undefined;
      if (!convexId) {
        convexId = await adapters.createDraft();
        row.convexId = convexId;
        await db.put("pendingInspections", row);
      }
      if (row.data && Object.keys(row.data).length > 0) {
        await adapters.patch({ id: convexId, patch: row.data as InspectionData });
      }
      await adapters.ensureSectionRows({ inspectionId: convexId });
      for (const [sectionTable, sectionData] of Object.entries(row.sections)) {
        await adapters.upsertSection({
          inspectionId: convexId,
          sectionTable,
          data: sectionData,
        });
      }
      await adapters.markSynced({ id: convexId });
      row.syncStatus = "synced";
      row.syncError = undefined;
      await db.put("pendingInspections", row);
      ok += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      row.syncStatus = "error";
      row.syncError = msg;
      await db.put("pendingInspections", row);
      errors += 1;
    }
  }

  return { ok, errors, timedOut };
}
