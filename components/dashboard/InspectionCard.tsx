"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Car, Copy, MoreVertical, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { browserAlert, browserConfirm } from "@/lib/browser-confirm";
import { cn } from "@/lib/utils";
import {
  formatInspectionDate,
  getInspectionUiStatus,
} from "@/lib/inspection-ui";

type InspectionCardProps = {
  inspection: Doc<"inspections">;
  pendingInSyncQueue?: boolean;
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

function formatVehicleLine(inspection: Doc<"inspections">): string {
  const brand = inspection.vehicleBrand?.trim();
  const model = inspection.vehicleModel?.trim();
  const year = inspection.vehicleYear;
  const parts = [
    [brand, model].filter(Boolean).join(" "),
    year ? String(year) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Vehículo";
}

function isDraft(inspection: Doc<"inspections">): boolean {
  if (inspection.reportDeliveredAt != null) return false;
  return (inspection.status ?? "draft") === "draft";
}

export function InspectionCard({
  inspection,
  pendingInSyncQueue,
}: InspectionCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { label, className: badgeClass } = getInspectionUiStatus(inspection, {
    pendingInSyncQueue,
  });
  const ts = inspection._creationTime;
  const findings = inspection.findingsCount ?? 0;
  const draft = isDraft(inspection);

  const removeDraft = useMutation(api.inspections.removeDraft);
  const duplicateInspection = useMutation(api.inspections.duplicateInspection);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const onLongPressStart = useCallback(() => {
    if (!draft) return;
    longPressTimer.current = setTimeout(() => {
      openMenu();
    }, 550);
  }, [draft, openMenu]);

  const onLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleDuplicate = async () => {
    closeMenu();
    const id = await duplicateInspection({ sourceId: inspection._id });
    router.push(`/inspecciones/${id}`);
  };

  const handleDelete = async () => {
    if (!browserConfirm("¿Eliminar este borrador? No se puede deshacer."))
      return;
    closeMenu();
    try {
      await removeDraft({ id: inspection._id });
    } catch {
      browserAlert("No se pudo eliminar el borrador.");
    }
  };

  return (
    <div className="relative flex items-stretch gap-1">
      <Link
        href={`/inspecciones/${inspection._id}`}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-colors active:bg-muted/50",
          draft && "touch-manipulation select-none",
        )}
        onTouchStart={onLongPressStart}
        onTouchEnd={onLongPressEnd}
        onTouchCancel={onLongPressEnd}
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Car className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-primary">{formatPlate(inspection)}</p>
          <p className="truncate text-sm text-muted-foreground">
            {formatVehicleLine(inspection)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatInspectionDate(ts)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "rounded-lg px-2 py-1 text-[10px] font-bold uppercase leading-none",
              badgeClass,
            )}
          >
            {label}
          </span>
          {findings > 0 ? (
            <span className="text-[10px] font-semibold text-amber-800">
              {findings} hallazgos
            </span>
          ) : null}
        </div>
      </Link>

      {draft ? (
        <div className="relative flex shrink-0 flex-col justify-center">
          <button
            type="button"
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Más opciones"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (menuOpen) closeMenu();
              else openMenu();
            }}
          >
            <MoreVertical className="size-5" />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default bg-transparent"
                aria-label="Cerrar menú"
                onClick={closeMenu}
              />
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-border bg-card py-1 shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => void handleDuplicate()}
                >
                  <Copy className="size-4" />
                  Duplicar
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="size-4" />
                  Eliminar borrador
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
