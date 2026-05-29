import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { isUuidV4, looksLikeConvexInspectionId } from "@/lib/inspection/idValidation";
import { getDB, type PendingInspectionRow } from "@/lib/offline/db";

export type ResolvedInspection =
  | { kind: "local_only"; row: PendingInspectionRow }
  | { kind: "convex"; clientId: string; convexId: Id<"inspections"> }
  | { kind: "not_found" };

/**
 * Id Convex usable en UI/mutaciones solo cuando la fila IDB terminó de sincronizar.
 * Durante `uploading`/`syncing`/`error` el borrador sigue siendo local-first.
 */
export function convexIdIfSyncedLocalRow(
  row: PendingInspectionRow,
): Id<"inspections"> | null {
  if (row.syncStatus !== "synced" || !row.convexId) return null;
  return row.convexId as Id<"inspections">;
}

/**
 * Dependencias inyectables (tests) — solo se invocan dentro de `resolveInspectionRef`,
 * nunca al importar el módulo.
 */
export type ResolveInspectionRefDeps = {
  loadLocalRow: (ref: string) => Promise<PendingInspectionRow | null>;
  fetchByClientId: (clientId: string) => Promise<Doc<"inspections"> | null>;
  fetchByConvexId: (id: Id<"inspections">) => Promise<Doc<"inspections"> | null>;
};

/**
 * Orden: IDB → UUID v4 (`getByClientId`) → id legacy Convex (`get`) → `not_found`.
 * Ver `docs/MIGRACION_LOCAL_FIRST_CHECKLIST.md` § Fase 3 — PR-E.
 *
 * El segundo argumento (`deps`) existe para **testabilidad** (inyección sin mocks de
 * imports). En código de producto, **no** armar `deps` ad-hoc desde pantallas: el
 * caller canónico es `useUnifiedInspection`, que usa `createConvexResolveDeps` con la
 * instancia real de Convex.
 */
export async function resolveInspectionRef(
  ref: string,
  deps: ResolveInspectionRefDeps,
): Promise<ResolvedInspection> {
  const normalized = ref.trim();
  if (!normalized) return { kind: "not_found" };

  const local = await deps.loadLocalRow(normalized);
  if (local) return { kind: "local_only", row: local };

  if (isUuidV4(normalized)) {
    const doc = await deps.fetchByClientId(normalized);
    if (!doc) return { kind: "not_found" };
    const clientId = doc.clientId?.trim() || normalized;
    return { kind: "convex", clientId, convexId: doc._id };
  }

  if (looksLikeConvexInspectionId(normalized)) {
    const id = normalized as Id<"inspections">;
    const doc = await deps.fetchByConvexId(id);
    if (!doc) return { kind: "not_found" };
    // Legacy: inspecciones creadas antes del backfill de clientId siguen enlazadas por `_id`.
    const clientId = doc.clientId?.trim() || doc._id;
    return { kind: "convex", clientId, convexId: doc._id };
  }

  return { kind: "not_found" };
}

/** Lectura IDB alineada a refs en URL (localId, clientId, convexId). */
export async function loadPendingInspectionRowByRef(
  ref: string,
): Promise<PendingInspectionRow | null> {
  const db = await getDB();
  let row: PendingInspectionRow | undefined = await db.get(
    "pendingInspections",
    ref,
  );
  if (!row) {
    const all = await db.getAll("pendingInspections");
    row = all.find(
      (r) =>
        r.convexId === ref ||
        String(r.clientId ?? "") === ref ||
        r.localId === ref,
    );
  }
  return row ?? null;
}

export function createConvexResolveDeps(
  convex: ConvexReactClient,
): ResolveInspectionRefDeps {
  return {
    loadLocalRow: loadPendingInspectionRowByRef,
    fetchByClientId: async (clientId) => {
      const trimmed = clientId.trim();
      if (!trimmed) return null;
      return await convex.query(api.inspections.getByClientId, {
        clientId: trimmed,
      });
    },
    fetchByConvexId: async (id) => {
      try {
        return await convex.query(api.inspections.get, { id });
      } catch {
        return null;
      }
    },
  };
}
