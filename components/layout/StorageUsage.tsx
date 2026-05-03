"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MIN_BYTES = 100 * 1024 * 1024; /** RNF-10: ≥ 100 MB */

/**
 * Muestra uso de almacenamiento (navigator.storage) respecto al mínimo requerido.
 */
export function StorageUsage() {
  const [used, setUsed] = useState<number | null>(null);
  const [quota, setQuota] = useState<number | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
      return;
    }
    void (async () => {
      const est = await navigator.storage.estimate();
      setUsed(est.usage ?? 0);
      setQuota(est.quota ?? 0);
    })();
  }, []);

  if (used == null) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  const pct = quota
    ? Math.min(100, (used / quota) * 100)
    : null;
  const meets = quota == null || quota >= MIN_BYTES;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {formatBytes(used)} usado
        {quota != null && (
          <span> · {formatBytes(quota)} cuota aprox. del origen (navegador)</span>
        )}
      </p>
      {pct != null && (
        <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full transition-[width]",
              meets ? "bg-primary" : "bg-destructive",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p
        className={cn(
          "text-xs",
          meets ? "text-success" : "text-destructive",
        )}
      >
        {meets
          ? "Cuota de almacenamiento suficiente (≥ 100 MB típicos en PWA web)."
          : "Cuota baja: liberá espacio o usá otra instancia del navegador."}
      </p>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
