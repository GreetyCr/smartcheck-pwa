"use client";

import Link from "next/link";
import { Car } from "lucide-react";
import type { PendingInspectionRow } from "@/lib/offline/db";
import { SyncStatusBadge } from "@/components/inspection/SyncStatusBadge";
import { formatInspectionDate } from "@/lib/inspection-ui";

function formatPlate(row: PendingInspectionRow): string {
  const id = row.data?.identifier;
  if (typeof id === "string" && id.trim()) {
    return id.trim().toUpperCase();
  }
  const plate = row.data?.plateNumber;
  if (typeof plate === "string" && plate.trim()) {
    return plate.trim().toUpperCase();
  }
  return "Sin placa";
}

function formatVehicleLine(row: PendingInspectionRow): string {
  const brand =
    typeof row.data?.vehicleBrand === "string" ? row.data.vehicleBrand : "";
  const model =
    typeof row.data?.vehicleModel === "string" ? row.data.vehicleModel : "";
  const year = row.data?.vehicleYear;
  const parts = [
    [brand, model].filter(Boolean).join(" "),
    typeof year === "number" ? String(year) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Vehículo";
}

type Props = { row: PendingInspectionRow };

/** Tarjeta de borrador solo en IDB (local-first). */
export function LocalInspectionCard({ row }: Props) {
  const href = `/inspecciones/${row.clientId ?? row.localId}`;
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-colors active:bg-muted/50"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Car className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-primary">{formatPlate(row)}</p>
        <p className="truncate text-sm text-muted-foreground">
          {formatVehicleLine(row)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatInspectionDate(row.updatedAt)}
        </p>
      </div>
      <SyncStatusBadge status={row.syncStatus} />
    </Link>
  );
}
