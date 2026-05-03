"use client";

import { CheckCircle, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSync } from "@/contexts/SyncContext";
import { StorageUsage } from "@/components/layout/StorageUsage";
import { getDB, type PendingInspectionRow } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SincronizarPage() {
  const { isOnline, pendingCount, isSyncing, lastSyncAt, syncNow } = useSync();
  const [pendingItems, setPendingItems] = useState<PendingInspectionRow[]>([]);

  const loadPendingItems = useCallback(async () => {
    const db = await getDB();
    const pending = await db.getAllFromIndex(
      "pendingInspections",
      "by-status",
      "pending",
    );
    setPendingItems(pending);
  }, []);

  useEffect(() => {
    void loadPendingItems();
  }, [loadPendingItems, pendingCount, isSyncing]);

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-xl font-bold text-foreground">Sincronización</h1>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="size-8 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <WifiOff className="size-8 shrink-0 text-amber-600" aria-hidden />
            )}
            <div>
              <p className="font-medium text-foreground">
                {isOnline ? "Conectado" : "Sin conexión"}
              </p>
              {lastSyncAt && (
                <p className="text-sm text-muted-foreground">
                  Última sincronización:{" "}
                  {lastSyncAt.toLocaleTimeString("es-CR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void syncNow().then(() => loadPendingItems())}
            disabled={!isOnline || isSyncing || pendingCount === 0}
            className="w-full sm:w-auto"
          >
            {isSyncing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Sincronizar ahora
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-foreground">
          Pendientes ({pendingCount})
        </h2>

        {pendingItems.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            <CheckCircle className="mx-auto mb-2 size-12 text-emerald-500" />
            <p>Todo sincronizado</p>
          </div>
        ) : (
          pendingItems.map((item) => (
            <div
              key={item.localId}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    {(item.data?.identifier as string) || "Sin placa"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[item.data?.vehicleBrand, item.data?.vehicleModel]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </p>
                </div>
                <StatusBadge status={item.syncStatus} />
              </div>
              {item.syncError && (
                <p className="mt-2 text-sm text-destructive">{item.syncError}</p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 font-medium text-foreground">
          Almacenamiento local
        </h3>
        <StorageUsage />
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: PendingInspectionRow["syncStatus"];
}) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        status === "error" && "bg-destructive/10 text-destructive",
        status === "syncing" && "bg-primary/10 text-primary",
        (status === "pending" || status === "synced") &&
          "bg-secondary text-secondary-foreground",
      )}
    >
      {status}
    </span>
  );
}
