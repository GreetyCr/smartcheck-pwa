"use client";

import { CheckCircle, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSync } from "@/contexts/SyncContext";
import { StorageUsage } from "@/components/layout/StorageUsage";
import { SyncStatusBadge } from "@/components/inspection/SyncStatusBadge";
import {
  listUnsyncedInspections,
  type PendingInspectionRow,
} from "@/lib/offline/db";
import { Button } from "@/components/ui/button";

export default function SincronizarPage() {
  const { isOnline, pendingCount, isSyncing, lastSyncAt, syncNow } = useSync();
  const [unsyncedItems, setUnsyncedItems] = useState<PendingInspectionRow[]>([]);

  const loadItems = useCallback(async () => {
    const rows = await listUnsyncedInspections();
    setUnsyncedItems(rows);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems, pendingCount, isSyncing]);

  const handleSyncAll = () => {
    void syncNow().then(() => loadItems());
  };

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
              {lastSyncAt ? (
                <p className="text-sm text-muted-foreground">
                  Última sincronización:{" "}
                  {lastSyncAt.toLocaleTimeString("es-CR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              ) : null}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSyncAll}
            disabled={!isOnline || isSyncing || unsyncedItems.length === 0}
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
          Pendientes ({unsyncedItems.length})
        </h2>

        {unsyncedItems.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            <CheckCircle className="mx-auto mb-2 size-12 text-emerald-500" />
            <p>Todo sincronizado</p>
          </div>
        ) : (
          unsyncedItems.map((item) => (
            <div
              key={item.localId}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
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
                <SyncStatusBadge status={item.syncStatus} />
              </div>
              {item.syncError ? (
                <p className="mt-2 text-sm text-destructive">{item.syncError}</p>
              ) : null}
              {item.syncStatus === "error" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={isSyncing}
                  onClick={() => void syncNow().then(() => loadItems())}
                >
                  Reintentar
                </Button>
              ) : null}
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
