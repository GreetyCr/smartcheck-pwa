"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { DashboardPageSkeleton } from "@/components/layout/DashboardPageSkeleton";
import { useUnifiedInspection } from "@/hooks/useUnifiedInspection";
import { useUnifiedDraftFlow } from "@/lib/featureFlags";
import { useSync } from "@/contexts/SyncContext";
import { INSPECTION_ROUTE_COPY } from "@/lib/inspection/inspectionRouteCopy";
import {
  convexIdForUnifiedRoute,
  type ResolvedInspection,
} from "@/lib/inspection/resolveInspectionRef";

export type InspectionRouteContextValue = {
  /** Segmento actual bajo `/inspecciones/` (UUID o id legacy Convex). */
  routeRef: string;
  unifiedFlow: boolean;
  /** Para `useQuery(api.inspections.get)` y mutaciones Convex; `null` = borrador solo IDB. */
  convexInspectionId: Id<"inspections"> | null;
  /** UUID canónico para links cuando el flujo unificado lo conoce. */
  canonicalClientId: string | null;
  resolution: ResolvedInspection | null;
};

const InspectionRouteContext = createContext<InspectionRouteContextValue | null>(
  null,
);

export function useInspectionRoute(): InspectionRouteContextValue {
  const v = useContext(InspectionRouteContext);
  if (!v) {
    throw new Error(
      "useInspectionRoute debe usarse dentro de InspectionRouteResolver",
    );
  }
  return v;
}

/** Segmento de URL para `/inspecciones/{segment}/…`. */
export function inspectionPathSegment(ctx: InspectionRouteContextValue): string {
  if (!ctx.unifiedFlow) return ctx.routeRef;
  return ctx.canonicalClientId ?? ctx.routeRef;
}

type ResolverState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error"; message: string }
  | { kind: "ready"; ctx: InspectionRouteContextValue };

function buildLegacyContext(trimmed: string): InspectionRouteContextValue {
  return {
    routeRef: trimmed,
    unifiedFlow: false,
    convexInspectionId: trimmed as Id<"inspections">,
    canonicalClientId: null,
    resolution: null,
  };
}

function buildUnifiedContext(
  trimmed: string,
  resolution: Exclude<ResolvedInspection, { kind: "not_found" }>,
  isOnline: boolean,
): InspectionRouteContextValue {
  if (resolution.kind === "convex") {
    return {
      routeRef: trimmed,
      unifiedFlow: true,
      convexInspectionId: resolution.convexId,
      canonicalClientId: resolution.clientId,
      resolution,
    };
  }
  const cid = String(resolution.row.clientId ?? resolution.row.localId);
  const cnv = convexIdForUnifiedRoute(resolution.row, isOnline);
  return {
    routeRef: trimmed,
    unifiedFlow: true,
    convexInspectionId: cnv,
    canonicalClientId: cid || null,
    resolution,
  };
}

/**
 * Boundary cliente: resuelve el segmento `[id]` de la URL (IDB → Convex), aplica
 * `router.replace` canónico cuando hace falta, y expone contexto a pantallas hijas.
 *
 * **Arquitectura PR-E2:** caller canónico de `useUnifiedInspection` en rutas de
 * inspección; no duplicar resolve + deps en páginas sueltas.
 */
export function InspectionRouteResolver({
  routeRef,
  children,
}: {
  routeRef: string;
  /** ReactNode serializable desde Server Components (no render props). */
  children: ReactNode;
}) {
  const unifiedFlow = useUnifiedDraftFlow();
  const { isOnline } = useSync();
  const inspection = useUnifiedInspection(unifiedFlow ? routeRef : undefined);
  const pathname = usePathname();
  const router = useRouter();

  const trimmed = routeRef.trim();

  useEffect(() => {
    if (!unifiedFlow) return;
    if (inspection.state.status !== "ready") return;
    const res = inspection.state.resolution;
    if (res.kind !== "convex") return;
    const canon = res.clientId.trim();
    if (canon.toLowerCase() === trimmed.toLowerCase()) return;
    const suffix = pathname.replace(/^\/inspecciones\/[^/]+/, "") || "";
    router.replace(`/inspecciones/${canon}${suffix}`);
  }, [unifiedFlow, inspection.state, trimmed, pathname, router]);

  const state = useMemo((): ResolverState => {
    if (!trimmed) return { kind: "not_found" };

    if (!unifiedFlow) {
      return { kind: "ready", ctx: buildLegacyContext(trimmed) };
    }

    if (inspection.state.status === "idle" || inspection.state.status === "loading") {
      return { kind: "loading" };
    }
    if (inspection.state.status === "error") {
      return { kind: "error", message: inspection.state.message };
    }
    if (inspection.state.status !== "ready") {
      return { kind: "loading" };
    }

    const res = inspection.state.resolution;
    if (res.kind === "not_found") {
      return { kind: "not_found" };
    }

    if (res.kind === "convex") {
      const canon = res.clientId.trim();
      if (canon.toLowerCase() !== trimmed.toLowerCase()) {
        return { kind: "loading" };
      }
      return { kind: "ready", ctx: buildUnifiedContext(trimmed, res, isOnline) };
    }

    return { kind: "ready", ctx: buildUnifiedContext(trimmed, res, isOnline) };
  }, [trimmed, unifiedFlow, inspection.state, isOnline]);

  if (state.kind === "loading") {
    return <DashboardPageSkeleton variant="detail" />;
  }

  if (state.kind === "not_found") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-base font-medium text-foreground">
          {INSPECTION_ROUTE_COPY.NOT_FOUND_TITLE}
        </p>
        <Link
          href="/inspecciones/nueva"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {INSPECTION_ROUTE_COPY.NOT_FOUND_CTA}
        </Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="p-6">
        <p className="text-destructive">{state.message}</p>
        <Link href="/" className="mt-2 inline-block text-primary underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const { ctx } = state;
  return (
    <InspectionRouteContext.Provider value={ctx}>
      {children}
    </InspectionRouteContext.Provider>
  );
}
