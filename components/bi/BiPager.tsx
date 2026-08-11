"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Paginación de una tabla del tablero.
 *
 * El `summary` es obligatorio y no decorativo: es lo que impide confundir "hay
 * un filtro puesto" con "hay menos filas". Siempre dice cuántas se ven, de
 * cuántas filtradas y de cuántas en total.
 */
export function BiPager({
  page,
  pageCount,
  onChange,
  summary,
}: {
  /** Página actual, base 1. */
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  summary: string;
}) {
  const btn = cn(
    "inline-flex size-11 items-center justify-center rounded-xl border border-[var(--bi-ring)] text-[var(--bi-ink-2)] transition-colors",
    "hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)]",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
    "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      {/* `role="status"` para que el lector de pantalla anuncie el cambio de
          página: sin esto, pulsar "siguiente" no informa nada. */}
      <p role="status" className="bi-num text-xs tabular-nums text-[var(--bi-ink-3)]">
        {summary}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={btn}
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="bi-num min-w-[72px] text-center text-xs tabular-nums text-[var(--bi-ink-2)]">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            className={btn}
            disabled={page >= pageCount}
            onClick={() => onChange(page + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
