"use client";

import { ConnectionStatusBar } from "@/components/layout/ConnectionStatus";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

/**
 * Banda de estado: modo online/offline + conexión y enlace a sincronización.
 */
export function StatusBar() {
  const online = useOnlineStatus();

  return (
    <div
      className={cn(
        "sticky top-0 z-40 flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-white sm:gap-4",
        online ? "bg-primary" : "bg-muted-foreground",
      )}
      role="status"
      aria-live="polite"
    >
      <span className="min-w-0 flex-1 text-center sm:text-left">
        {online ? "En línea" : "Modo sin conexión: los cambios se guardan en el dispositivo"}
      </span>
      <div className="w-full min-w-0 sm:w-auto">
        <ConnectionStatusBar
          className="justify-center sm:justify-end"
          showSyncLink
          onColoredBar
        />
      </div>
    </div>
  );
}
