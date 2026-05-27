"use client";

import Link from "next/link";
import { History } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatInspectionDate, getInspectionUiStatus } from "@/lib/inspection-ui";
import { cn } from "@/lib/utils";

type VehicleHistoryProps = {
  plateLabel: string;
  inspections: Doc<"inspections">[] | undefined;
  onClose?: () => void;
};

function formatPlate(inspection: Doc<"inspections">): string {
  if (inspection.identifierType === "placa" && inspection.identifier?.trim()) {
    return inspection.identifier.trim().toUpperCase();
  }
  if (inspection.identifier?.trim()) {
    return inspection.identifier.trim().slice(-8);
  }
  return "Sin placa";
}

export function VehicleHistory({
  plateLabel,
  inspections,
  onClose,
}: VehicleHistoryProps) {
  const count = inspections?.length ?? 0;
  if (count < 2) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="size-5 text-primary" aria-hidden />
          <div>
            <h3 className="text-sm font-bold text-primary">
              Historial del vehículo
            </h3>
            <p className="text-xs text-muted-foreground">
              Placa {plateLabel} · {count} inspecciones
            </p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            Ocultar
          </button>
        ) : null}
      </div>
      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {inspections!.map((row) => {
          const { label, className: badgeClass } = getInspectionUiStatus(row);
          return (
            <li key={row._id}>
              <Link
                href={`/inspecciones/${row.clientId?.trim() || row._id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-sm transition-colors active:bg-muted/60"
              >
                <span className="font-semibold text-foreground">
                  {formatPlate(row)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatInspectionDate(row._creationTime)}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase",
                    badgeClass,
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
