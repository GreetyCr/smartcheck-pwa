"use client";

import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import type { PendingInspectionRow } from "@/lib/offline/db";
import { InspectionCard } from "@/components/dashboard/InspectionCard";
import { LocalInspectionCard } from "@/components/dashboard/LocalInspectionCard";

function ListSkeleton() {
  return (
    <section className="space-y-3" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[88px] animate-pulse rounded-2xl bg-muted/80"
        />
      ))}
    </section>
  );
}

type RecentInspectionsListProps = {
  title?: string;
  inspections: Doc<"inspections">[] | undefined;
  localDrafts?: PendingInspectionRow[];
  loading: boolean;
  emptyMessage?: string;
  showViewAllHref?: string;
  viewAllLabel?: string;
  pendingInSyncQueue?: (inspection: Doc<"inspections">) => boolean;
  idbSyncStatus?: (
    inspection: Doc<"inspections">,
  ) => PendingInspectionRow["syncStatus"] | undefined;
};

export function RecentInspectionsList({
  title = "Inspecciones recientes",
  inspections,
  localDrafts = [],
  loading,
  emptyMessage = 'No hay inspecciones aún. Crea una con "Nueva inspección".',
  showViewAllHref = "/historial",
  viewAllLabel = "Ver todas",
  pendingInSyncQueue,
  idbSyncStatus,
}: RecentInspectionsListProps) {
  if (loading) {
    return <ListSkeleton />;
  }

  const rows = inspections ?? [];
  const hasRows = rows.length > 0 || localDrafts.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-primary">{title}</h2>
        <Link
          href={showViewAllHref}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {viewAllLabel}
        </Link>
      </div>

      {!hasRows ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {localDrafts.map((row) => (
            <li key={`local-${row.localId}`}>
              <LocalInspectionCard row={row} />
            </li>
          ))}
          {rows.map((inspection) => (
            <li key={inspection._id}>
              <InspectionCard
                inspection={inspection}
                pendingInSyncQueue={pendingInSyncQueue?.(inspection)}
                idbSyncStatus={idbSyncStatus?.(inspection)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
