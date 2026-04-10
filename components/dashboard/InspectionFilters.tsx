"use client";

import { cn } from "@/lib/utils";

export type InspectionStatusFilter =
  | "all"
  | "draft"
  | "completed"
  | "pending_sync"
  | "synced";

const FILTERS: { id: InspectionStatusFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "draft", label: "Borrador" },
  { id: "completed", label: "Completado" },
  { id: "pending_sync", label: "Pendiente sync" },
  { id: "synced", label: "Sincronizado" },
];

type InspectionFiltersProps = {
  value: InspectionStatusFilter;
  onChange: (next: InspectionStatusFilter) => void;
  className?: string;
};

export function InspectionFilters({
  value,
  onChange,
  className,
}: InspectionFiltersProps) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="tablist"
      aria-label="Filtrar por estado"
    >
      {FILTERS.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/80",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
