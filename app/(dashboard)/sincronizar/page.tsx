"use client";

import { AlertTriangle, CheckCircle, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSync } from "@/contexts/SyncContext";
import { StorageUsage } from "@/components/layout/StorageUsage";
import { SyncStatusBadge } from "@/components/inspection/SyncStatusBadge";
import {
  listPendingPhotosForInspection,
  listUnsyncedInspections,
  type PendingInspectionRow,
  type PendingPhotoRow,
} from "@/lib/offline/db";
import { Button } from "@/components/ui/button";

type ItemDiagnostics = {
  row: PendingInspectionRow;
  photoErrors: PendingPhotoRow[];
};

export default function SincronizarPage() {
  const { isOnline, pendingCount, isSyncing, lastSyncAt, lastSyncError, syncNow } =
    useSync();
  const [items, setItems] = useState<ItemDiagnostics[]>([]);

  const loadItems = useCallback(async () => {
    const rows = await listUnsyncedInspections();
    const withPhotos = await Promise.all(
      rows.map(async (row) => {
        const photos = await listPendingPhotosForInspection(row.localId);
        const photoErrors = photos.filter(
          (p) => p.status === "error" && p.syncError,
        );
        return { row, photoErrors };
      }),
    );
    setItems(withPhotos);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems, pendingCount, isSyncing, lastSyncError]);

  const handleSyncAll = () => {
    void syncNow().then(() => loadItems());
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-xl font-bold text-foreground">Sincronización</h1>

      {lastSyncError ? (
        <div
          className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Último error de sincronización</p>
            <p className="mt-1 break-words">{lastSyncError}</p>
            <p className="mt-2 text-xs text-destructive/90">
              Si el error menciona una foto, capturala de nuevo en la inspección o
              descartá el borrador local.
            </p>
          </div>
        </div>
      ) : null}

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
            disabled={!isOnline || isSyncing || items.length === 0}
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
          Pendientes ({items.length})
        </h2>

        {items.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            <CheckCircle className="mx-auto mb-2 size-12 text-emerald-500" />
            <p>Todo sincronizado</p>
          </div>
        ) : (
          items.map(({ row: item, photoErrors }) => (
            <div
              key={item.localId}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    {(item.data?.identifier as string) ||
                      (item.data?.clientName as string) ||
                      "Sin placa"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[item.data?.vehicleBrand, item.data?.vehicleModel]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ID local: …{item.localId.slice(-8)}
                  </p>
                </div>
                <SyncStatusBadge status={item.syncStatus} />
              </div>
              {item.syncError ? (
                <p className="mt-2 break-words text-sm text-destructive">
                  {item.syncError}
                </p>
              ) : null}
              {photoErrors.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-destructive">
                  {photoErrors.map((p) => (
                    <li key={p.id} className="break-words">
                      Foto {p.slot ?? p.itemKey}: {p.syncError}
                    </li>
                  ))}
                </ul>
              ) : null}
              {item.syncStatus === "error" ||
              photoErrors.length > 0 ||
              item.syncStatus === "pending" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={!isOnline || isSyncing}
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
