"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SearchBar } from "@/components/dashboard/SearchBar";
import {
  InspectionFilters,
  type InspectionStatusFilter,
} from "@/components/dashboard/InspectionFilters";
import { InspectionCard } from "@/components/dashboard/InspectionCard";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE = 30;

export default function HistorialPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 400);
  const [filter, setFilter] = useState<InspectionStatusFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [refresh, setRefresh] = useState(0);

  const statusArg = filter === "all" ? undefined : filter;
  const searching = debounced.trim().length > 0;

  const listArgs =
    isLoaded && isSignedIn && !searching
      ? { status: statusArg, limit, refresh }
      : "skip";
  const searchArgs =
    isLoaded && isSignedIn && searching
      ? { query: debounced.trim(), refresh }
      : "skip";

  const list = useQuery(api.inspections.listByClerkUser, listArgs);
  const searched = useQuery(api.inspections.search, searchArgs);

  const filtered = useMemo(() => {
    const rows = searching ? (searched ?? []) : (list ?? []);
    if (!searching || filter === "all") return rows;
    return rows.filter((r) => (r.status ?? "draft") === filter);
  }, [searching, searched, list, filter]);

  const loading =
    !isLoaded ||
    (isSignedIn &&
      (searching ? searched === undefined : list === undefined));

  const canLoadMore =
    !searching && !loading && (list?.length ?? 0) === limit;

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-6 pt-4 text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-6 pt-4 text-center text-sm text-muted-foreground">
        Inicia sesión para ver el historial.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-primary">Historial</h1>
      <p className="text-sm text-muted-foreground">
        Todas tus inspecciones, ordenadas por fecha (más recientes primero).
      </p>

      <SearchBar value={search} onChange={setSearch} />
      <InspectionFilters value={filter} onChange={setFilter} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando inspecciones…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {searching
            ? "No hay coincidencias."
            : "No hay inspecciones en este filtro."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((row) => (
            <li key={row._id}>
              <InspectionCard inspection={row} />
            </li>
          ))}
        </ul>
      )}

      {!searching && canLoadMore ? (
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-xl"
          onClick={() => setLimit((n) => n + PAGE)}
        >
          Cargar más
        </Button>
      ) : null}

      <button
        type="button"
        className="w-full text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        onClick={() => {
          setLimit(PAGE);
          setRefresh((r) => r + 1);
        }}
      >
        Actualizar lista
      </button>
    </div>
  );
}
