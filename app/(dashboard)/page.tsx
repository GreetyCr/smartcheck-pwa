"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SearchBar } from "@/components/dashboard/SearchBar";
import { SyncStatusCard } from "@/components/dashboard/SyncStatusCard";
import { NewInspectionCTA } from "@/components/dashboard/NewInspectionCTA";
import { RecentInspectionsList } from "@/components/dashboard/RecentInspectionsList";
import {
  InspectionFilters,
  type InspectionStatusFilter,
} from "@/components/dashboard/InspectionFilters";
import { VehicleHistory } from "@/components/dashboard/VehicleHistory";
import { PullToRefresh } from "@/components/dashboard/PullToRefresh";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSyncQueue } from "@/hooks/useSyncQueue";

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 400);
  const [filter, setFilter] = useState<InspectionStatusFilter>("all");
  const [refresh, setRefresh] = useState(0);
  const [hideVehicleHistory, setHideVehicleHistory] = useState(false);
  useEffect(() => {
    setHideVehicleHistory(false);
  }, [debounced]);

  const { pendingCount, lastSyncLabel, isSyncing, flush } = useSyncQueue();

  const statusArg = filter === "all" ? undefined : filter;

  const searching = debounced.trim().length > 0;

  const listArgs =
    isLoaded && isSignedIn && !searching
      ? { status: statusArg, limit: 25, refresh }
      : "skip";

  const searchArgs =
    isLoaded && isSignedIn && searching
      ? { query: debounced.trim(), refresh }
      : "skip";

  const list = useQuery(api.inspections.listByClerkUser, listArgs);
  const searched = useQuery(api.inspections.search, searchArgs);

  const historyPlate = debounced.trim().toUpperCase().replace(/\s+/g, "");
  const historyArgs =
    isLoaded &&
    isSignedIn &&
    historyPlate.length >= 4 &&
    !hideVehicleHistory &&
    searching
      ? { plate: historyPlate, refresh }
      : "skip";
  const vehicleHistory = useQuery(api.inspections.getVehicleHistory, historyArgs);

  const filtered = useMemo(() => {
    const rows = searching ? (searched ?? []) : (list ?? []);
    if (!searching || filter === "all") {
      return rows;
    }
    return rows.filter((r) => (r.status ?? "draft") === filter);
  }, [searching, searched, list, filter]);

  const loading =
    !isLoaded ||
    (isSignedIn &&
      (searching ? searched === undefined : list === undefined));

  const onRefresh = async () => {
    setRefresh((n) => n + 1);
    if (pendingCount > 0) {
      await flush();
    }
  };

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-6 pt-4">
        <RecentInspectionsList inspections={undefined} loading />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-6 pt-4 text-center text-sm text-muted-foreground">
        Inicia sesión para ver tu tablero de inspecciones.
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className="mx-auto max-w-lg space-y-4 px-4 pb-6 pt-4">
        <SearchBar value={search} onChange={setSearch} />

        <InspectionFilters value={filter} onChange={setFilter} />

        <SyncStatusCard
          pendingCount={pendingCount}
          lastSyncLabel={lastSyncLabel}
          isSyncing={isSyncing}
          onSync={() => void flush()}
        />

        <NewInspectionCTA />

        {vehicleHistory !== undefined &&
        vehicleHistory.length >= 2 &&
        searching ? (
          <VehicleHistory
            plateLabel={historyPlate}
            inspections={vehicleHistory}
            onClose={() => setHideVehicleHistory(true)}
          />
        ) : null}

        <RecentInspectionsList
          title={searching ? "Resultados" : "Inspecciones recientes"}
          inspections={filtered}
          loading={loading}
          emptyMessage={
            searching
              ? "No hay coincidencias con tu búsqueda."
              : undefined
          }
        />
      </div>
    </PullToRefresh>
  );
}
