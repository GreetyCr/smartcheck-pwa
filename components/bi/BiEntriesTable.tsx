"use client";

import { Pencil, Trash2 } from "lucide-react";
import {
  categoryLabel,
  formatCRC,
  formatDateCR,
} from "@/lib/bi-format";
import type { FinanceEntry } from "./types";

/**
 * Tabla de movimientos del periodo — es también la **vista tabular** de los
 * gráficos (valores exactos, ordenables por lectura directa). Cifras en mono
 * tabular para que las columnas alineen. Las acciones aparecen al hover/foco
 * donde hay puntero y quedan siempre visibles en táctil (ver globals.css).
 */
export function BiEntriesTable({
  entries,
  onEdit,
  onDelete,
  busyId,
}: {
  entries: FinanceEntry[];
  onEdit?: (e: FinanceEntry) => void;
  onDelete?: (e: FinanceEntry) => void;
  busyId?: string | null;
}) {
  if (entries.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-[var(--bi-ink-2)]">
          No hay movimientos en este periodo.
        </p>
        <p className="mt-1 text-xs text-[var(--bi-ink-3)]">
          Usá “Registrar movimiento” para agregar el primero.
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <caption className="sr-only">
          Movimientos financieros del periodo seleccionado
        </caption>
        <thead>
          <tr className="border-b border-[var(--bi-ring)]">
            {["Fecha", "Tipo", "Categoría", "Detalle", "Monto", ""].map(
              (h, i) => (
                <th
                  key={h + i}
                  scope="col"
                  className={`bi-num px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--bi-ink-3)] ${
                    h === "Monto" ? "text-right" : ""
                  }`}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const isIncome = e.kind === "income";
            const busy = busyId === e.id;
            return (
              <tr
                key={e.id}
                className={`border-b border-[var(--bi-ring)]/60 transition-colors last:border-0 hover:bg-[var(--bi-surface-2)] ${
                  busy ? "opacity-50" : ""
                }`}
              >
                <td className="bi-num whitespace-nowrap px-4 py-3 text-[13px] text-[var(--bi-ink-2)]">
                  {formatDateCR(e.date)}
                </td>
                <td className="px-4 py-3">
                  {/* tipo con punto de color + rótulo: nunca color solo */}
                  <span className="inline-flex items-center gap-2 text-[13px] text-[var(--bi-ink-2)]">
                    <span
                      aria-hidden
                      className="size-2 rounded-[2px]"
                      style={{
                        background: isIncome
                          ? "var(--bi-income)"
                          : "var(--bi-expense)",
                      }}
                    />
                    {isIncome ? "Ingreso" : "Gasto"}
                  </span>
                </td>
                <td className="px-4 py-3 text-[13px] text-[var(--bi-ink)]">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {categoryLabel(e.category)}
                    {e.isViatico ? (
                      <span className="rounded-full border border-[var(--bi-ring)] px-1.5 py-px text-[10px] text-[var(--bi-ink-3)]">
                        viático
                      </span>
                    ) : null}
                    {e.source === "sheet" ? (
                      <span className="rounded-full border border-[var(--bi-ring)] px-1.5 py-px text-[10px] text-[var(--bi-ink-3)]">
                        sheet
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="max-w-[220px] px-4 py-3 text-[13px] text-[var(--bi-ink-3)]">
                  <span className="block truncate">
                    {[e.tecnico, e.localidad, e.note]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </td>
                <td className="bi-num whitespace-nowrap px-4 py-3 text-right text-[13px] font-medium text-[var(--bi-ink)]">
                  {formatCRC(e.amountCRC)}
                  {e.originalCurrency === "USD" ? (
                    <span className="ml-1.5 text-[11px] text-[var(--bi-ink-3)]">
                      (US${e.originalAmount})
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span className="bi-row-actions flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit?.(e)}
                      disabled={busy}
                      aria-label={`Editar movimiento de ${categoryLabel(e.category)} del ${formatDateCR(e.date)}`}
                      className="rounded-lg p-1.5 text-[var(--bi-ink-3)] transition-colors hover:bg-white/5 hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] disabled:opacity-40"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(e)}
                      disabled={busy}
                      aria-label={`Eliminar movimiento de ${categoryLabel(e.category)} del ${formatDateCR(e.date)}`}
                      className="rounded-lg p-1.5 text-[var(--bi-ink-3)] transition-colors hover:bg-white/5 hover:text-[var(--bi-bad)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-bad)] disabled:opacity-40"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
