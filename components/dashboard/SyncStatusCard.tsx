"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SyncStatusCardProps = {
  pendingCount: number;
  errorCount?: number;
  lastSyncLabel?: string;
  isSyncing?: boolean;
  onSync?: () => void;
};

export function SyncStatusCard({
  pendingCount,
  errorCount = 0,
  lastSyncLabel = "Última hace —",
  isSyncing = false,
  onSync,
}: SyncStatusCardProps) {
  const hasErrors = errorCount > 0;
  if (pendingCount <= 0 && !hasErrors) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3",
        hasErrors
          ? "border-destructive/30 bg-destructive/[0.06]"
          : "border-primary/10 bg-primary/[0.06]",
      )}
    >
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl text-primary-foreground",
          hasErrors ? "bg-destructive" : "bg-primary",
        )}
      >
        {hasErrors ? (
          <AlertTriangle className="size-5" aria-hidden />
        ) : (
          <RefreshCw
            className={cn("size-5", isSyncing && "animate-spin")}
            aria-hidden
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {hasErrors ? (
          <p className="text-sm font-bold text-destructive">
            {errorCount}{" "}
            {errorCount === 1
              ? "inspección con error de sync"
              : "inspecciones con error de sync"}
          </p>
        ) : (
          <p className="text-sm font-bold text-primary">
            {pendingCount}{" "}
            {pendingCount === 1
              ? "Sincronización pendiente"
              : "Sincronizaciones pendientes"}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{lastSyncLabel}</p>
      </div>
      <Button
        type="button"
        variant={hasErrors ? "destructive" : "default"}
        size="sm"
        disabled={isSyncing}
        className="shrink-0 rounded-xl font-semibold"
        onClick={onSync}
      >
        {isSyncing ? "Sincronizando…" : hasErrors ? "Reintentar" : "Sincronizar"}
      </Button>
    </div>
  );
}

/** Alias retrocompatible */
export const SyncPendingCard = SyncStatusCard;
