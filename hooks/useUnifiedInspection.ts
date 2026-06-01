"use client";

import { useConvex } from "convex/react";
import { startTransition, useEffect, useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { PendingInspectionRow } from "@/lib/offline/db";
import { useSync } from "@/contexts/SyncContext";
import {
  convexIdForUnifiedRoute,
  createConvexResolveDeps,
  resolveInspectionRef,
  type ResolvedInspection,
} from "@/lib/inspection/resolveInspectionRef";

export type UnifiedInspectionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; resolution: ResolvedInspection }
  | { status: "error"; message: string };

type NonIdleUnifiedState = Exclude<UnifiedInspectionState, { status: "idle" }>;

function syncStatusFromResolution(
  resolution: ResolvedInspection,
): PendingInspectionRow["syncStatus"] | "synced" | undefined {
  if (resolution.kind === "local_only") return resolution.row.syncStatus;
  if (resolution.kind === "convex") return "synced";
  return undefined;
}

/**
 * Resuelve `ref` de URL (IDB → Convex por `clientId` o `_id` legacy).
 * Sin efectos al importar el módulo; solo al montar / cambiar `ref`.
 */
export function useUnifiedInspection(ref: string | undefined): {
  state: UnifiedInspectionState;
  /** Presente solo con `state.status === "ready"`. */
  resolution: ResolvedInspection | undefined;
  syncStatus: PendingInspectionRow["syncStatus"] | "synced" | undefined;
  clientId: string | undefined;
  convexId: Id<"inspections"> | undefined;
} {
  const convex = useConvex();
  const { isOnline } = useSync();
  const deps = useMemo(() => createConvexResolveDeps(convex), [convex]);
  const trimmed = useMemo(() => (ref ?? "").trim(), [ref]);

  const [internal, setInternal] = useState<NonIdleUnifiedState>({
    status: "loading",
  });

  useEffect(() => {
    if (!trimmed) return;
    let cancelled = false;
    startTransition(() => {
      setInternal({ status: "loading" });
    });
    void (async () => {
      try {
        const resolution = await resolveInspectionRef(trimmed, deps);
        if (!cancelled) setInternal({ status: "ready", resolution });
      } catch (e) {
        if (!cancelled) {
          setInternal({
            status: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trimmed, deps]);

  const state: UnifiedInspectionState = !trimmed
    ? { status: "idle" }
    : internal;

  const resolution = state.status === "ready" ? state.resolution : undefined;
  const syncStatus = resolution ? syncStatusFromResolution(resolution) : undefined;
  const clientId =
    resolution?.kind === "convex"
      ? resolution.clientId
      : resolution?.kind === "local_only"
        ? String(resolution.row.clientId ?? resolution.row.localId)
        : undefined;
  const convexId =
    resolution?.kind === "convex"
      ? resolution.convexId
      : resolution?.kind === "local_only"
        ? (convexIdForUnifiedRoute(resolution.row, isOnline) ?? undefined)
        : undefined;

  return { state, resolution, syncStatus, clientId, convexId };
}
