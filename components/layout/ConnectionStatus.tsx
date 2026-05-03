"use client";

import { CloudUpload, Loader2, Wifi, WifiOff } from "lucide-react";
import { useSync } from "@/contexts/SyncContext";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ConnectionStatusProps = {
  /** Sobre barra de color (p. ej. `StatusBar` primary). */
  onColoredBar?: boolean;
};

/**
 * Indicador compacto: conectado / sin conexión / sincronizando / pendientes.
 */
export function ConnectionStatus({ onColoredBar = false }: ConnectionStatusProps) {
  const { isOnline, pendingCount, isSyncing, syncNow } = useSync();

  const base = onColoredBar
    ? "border border-white/30 bg-white/15 text-white"
    : "";

  if (isSyncing) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1",
          onColoredBar
            ? base
            : "bg-blue-100 text-blue-800",
        )}
        role="status"
      >
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        <span className="text-xs font-medium">Sincronizando…</span>
      </div>
    );
  }

  if (isOnline && pendingCount === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5",
          onColoredBar ? "text-white" : "text-emerald-700",
        )}
        role="status"
      >
        <Wifi className="size-3.5 shrink-0" aria-hidden />
        <span className="text-xs">Conectado</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div
        className={cn(
          "flex max-w-[min(100%,18rem)] flex-wrap items-center gap-1.5 rounded-full px-2.5 py-1",
          onColoredBar
            ? base
            : "bg-amber-100 text-amber-900",
        )}
        role="status"
      >
        <WifiOff className="size-3.5 shrink-0" aria-hidden />
        <span className="text-xs font-medium">Sin conexión</span>
        {pendingCount > 0 && (
          <span className="text-xs">({pendingCount} pend.)</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition",
        onColoredBar
          ? "border border-white/30 bg-white/15 text-white hover:bg-white/25"
          : "bg-orange-100 text-orange-900 hover:bg-orange-200",
      )}
    >
      <CloudUpload className="size-3.5 shrink-0" aria-hidden />
      <span className="text-xs font-medium">{pendingCount} pendiente(s)</span>
    </button>
  );
}

type ConnectionStatusBarProps = {
  className?: string;
  showSyncLink?: boolean;
  onColoredBar?: boolean;
};

export function ConnectionStatusBar({
  className,
  showSyncLink = true,
  onColoredBar = false,
}: ConnectionStatusBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2",
        className,
      )}
    >
      <ConnectionStatus onColoredBar={onColoredBar} />
      {showSyncLink && (
        <Link
          href="/sincronizar"
          className={cn(
            "text-xs font-medium underline-offset-2 hover:underline",
            onColoredBar
              ? "text-white/90 hover:text-white"
              : "text-primary",
          )}
        >
          Sincronizar
        </Link>
      )}
    </div>
  );
}
