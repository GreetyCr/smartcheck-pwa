"use client";

import { categoryLabel, formatCRC } from "@/lib/bi-format";

/**
 * Barras horizontales por categoría (una sola serie → sin leyenda; el título la
 * nombra). Todas las barras comparten el hue de la serie a la que pertenecen:
 * el color sigue a la **entidad** (gastos), no al valor de cada barra.
 * Rótulos directos con el monto exacto.
 */
export function BiCategoryBars({
  rows,
  tone = "expense",
  emptyLabel = "Sin movimientos en el periodo.",
}: {
  rows: { category: string; amountCRC: number }[];
  tone?: "income" | "expense";
  emptyLabel?: string;
}) {
  const color = tone === "income" ? "var(--bi-income)" : "var(--bi-expense)";
  const max = Math.max(1, ...rows.map((r) => r.amountCRC));

  if (rows.length === 0) {
    return <p className="text-xs text-[var(--bi-ink-3)]">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.category}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] text-[var(--bi-ink-2)]">
              {categoryLabel(r.category)}
            </span>
            <span className="bi-num shrink-0 text-[13px] text-[var(--bi-ink)]">
              {formatCRC(r.amountCRC)}
            </span>
          </div>
          <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
            <div
              className="bi-grow-x h-full rounded-full"
              style={{
                width: `${Math.max((r.amountCRC / max) * 100, 2)}%`,
                background: color,
                animationDelay: `${i * 50}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
