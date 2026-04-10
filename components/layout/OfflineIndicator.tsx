"use client";

/**
 * Indicador de estado offline (banner o badge).
 */
export function OfflineIndicator() {
  return (
    <div className="bg-warning/20 text-warning px-2 py-1 text-center text-sm">
      Sin conexión
    </div>
  );
}
