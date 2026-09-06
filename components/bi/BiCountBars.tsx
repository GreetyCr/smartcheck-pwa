"use client";

import { formatInt } from "@/lib/bi-format";

export type CountBarRow = {
  key: string;
  label: string;
  value: number;
  /** Texto corto a la derecha del valor (porcentaje, base, aclaración). */
  meta?: string;
};

/**
 * Barras horizontales de conteos, una sola serie → sin leyenda: el título de la
 * tarjeta la nombra. Rótulo directo con el valor exacto en cada fila, así que
 * no hace falta tooltip para leer un número.
 *
 * La escala es común a todas las filas (`total` si se pasa, si no el máximo).
 * En el embudo eso deja la última barra casi invisible —eran 217 sobre 9.096 al
 * 25-ago-2026— y así
 * tiene que ser: la conversión ES una astilla, y suavizarla mentiría. El piso
 * de 2px garantiza que la barra exista aunque el valor sea diminuto.
 */
export function BiCountBars({
  rows,
  total,
  emptyLabel = "Sin datos en el periodo.",
}: {
  rows: CountBarRow[];
  /** Base de la escala. Por defecto, el valor más alto de la lista. */
  total?: number;
  emptyLabel?: string;
}) {
  const max = Math.max(1, total ?? 0, ...rows.map((r) => r.value));

  if (rows.length === 0) {
    return <p className="text-xs text-[var(--bi-ink-3)]">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] text-[var(--bi-ink-2)]">
              {r.label}
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="bi-num text-[13px] tabular-nums text-[var(--bi-ink)]">
                {formatInt(r.value)}
              </span>
              {r.meta ? (
                <span className="bi-num text-[11px] tabular-nums text-[var(--bi-ink-3)]">
                  {r.meta}
                </span>
              ) : null}
            </span>
          </div>
          <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
            <div
              className="bi-grow-x h-full rounded-full"
              style={{
                width: `${Math.max((r.value / max) * 100, 2)}%`,
                /* Una sola serie → un solo color para todas las barras. Pintar
                   más oscuro lo más grande sería codificar dos veces el mismo
                   dato y quemar el único canal libre que queda. */
                background: "var(--bi-income)",
                animationDelay: `${i * 50}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
