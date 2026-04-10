"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SyncStatusCardProps = {
  pendingCount: number;
  lastSyncLabel?: string;
  isSyncing?: boolean;
  onSync?: () => void;
};

export function SyncStatusCard({
  pendingCount,
  lastSyncLabel = "Última hace —",
  isSyncing = false,
  onSync,
}: SyncStatusCardProps) {
  if (pendingCount <= 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-primary/[0.06] px-4 py-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <RefreshCw
          className={cn("size-5", isSyncing && "animate-spin")}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-primary">
          {pendingCount}{" "}
          {pendingCount === 1
            ? "Sincronización pendiente"
            : "Sincronizaciones pendientes"}
        </p>
        <p className="text-xs text-muted-foreground">{lastSyncLabel}</p>
      </div>
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={isSyncing}
        className="shrink-0 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        onClick={onSync}
      >
        {isSyncing ? "Sincronizando…" : "Sincronizar"}
      </Button>
    </div>
  );
}

/** Alias retrocompatible */
export const SyncPendingCard = SyncStatusCard;
