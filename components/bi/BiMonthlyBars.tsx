"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatCompactCRC,
  formatCRC,
  formatMonthAbbr,
  formatMonthLong,
  formatMonthShort,
} from "@/lib/bi-format";
import type { FinanceMonth } from "./types";

/**
 * Barras agrupadas ingresos vs. gastos por mes.
 *
 * Decisiones de la guía de dataviz:
 *  - Dos series → **leyenda siempre presente** (la identidad no depende del color solo).
 *  - Marcas delgadas, extremo superior redondeado 4px anclado a la línea base,
 *    2px de separación entre barras adyacentes.
 *  - Rejilla y ejes recesivos (hairline), un solo eje de valor.
 *  - Sin rótulo numérico en cada barra: valores exactos en hover y en el
 *    `aria-label` de cada mes; la tabla de movimientos es la vista tabular.
 */
export function BiMonthlyBars({
  months,
  selected,
  onSelect,
}: {
  months: FinanceMonth[];
  selected?: string | null;
  onSelect?: (yearMonth: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
  const mid = max / 2;

  /**
   * Cada cuántos meses se rotula **en pantalla angosta**.
   *
   * Con 14 meses en 375px cada barra tiene 13px y «AGO» mide 19: los rótulos se
   * pisan entre sí y el eje se vuelve ilegible. Medido, no supuesto. Rotular uno
   * de cada dos les da 26px y vuelven a leerse; los meses saltados siguen
   * teniendo su barra, su tooltip y su `aria-label`, así que no se pierde nada
   * — solo deja de escribirse lo que no cabía.
   */
  const pasoAngosto = months.length > 8 ? 2 : 1;

  return (
    <div>
      {/* leyenda */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {(
          [
            { key: "income", label: "Ingresos", color: "var(--bi-income)" },
            { key: "expense", label: "Gastos", color: "var(--bi-expense)" },
          ] as const
        ).map((s) => (
          <span
            key={s.key}
            className="inline-flex items-center gap-2 text-xs text-[var(--bi-ink-2)]"
          >
            <span
              aria-hidden
              className="size-2.5 rounded-[3px]"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative">
        {/* rejilla recesiva + escala */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bottom-6">
          {[
            { v: max, top: "0%" },
            { v: mid, top: "50%" },
          ].map((g) => (
            <div
              key={g.top}
              className="absolute inset-x-0 flex items-center gap-2"
              style={{ top: g.top }}
            >
              <span className="bi-num w-12 shrink-0 text-right text-[10px] text-[var(--bi-ink-3)]">
                {formatCompactCRC(g.v)}
              </span>
              <span className="h-px flex-1 bg-[var(--bi-grid)]" />
            </div>
          ))}
        </div>

        {/* línea base: 24px desde el fondo = donde apoyan las barras (bajo ellas,
            sobre la fila de etiquetas que ocupa ese espacio) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-6 left-14 h-px bg-[var(--bi-axis)]"
        />

        {/* área de trazado */}
        <div className="relative flex h-[220px] items-end gap-1.5 pl-14 sm:gap-2">
          {months.map((m, i) => {
            const isSel = selected === m.yearMonth;
            const isHover = hover === m.yearMonth;
            const dim = hover !== null && !isHover;
            return (
              <button
                key={m.yearMonth}
                type="button"
                onClick={() => onSelect?.(m.yearMonth)}
                onMouseEnter={() => setHover(m.yearMonth)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.yearMonth)}
                onBlur={() => setHover(null)}
                aria-pressed={isSel}
                aria-label={`${formatMonthLong(m.yearMonth)}: ingresos ${formatCRC(
                  m.income,
                )}, gastos ${formatCRC(m.expense)}, utilidad ${formatCRC(
                  m.utilidad,
                )}. ${m.rows} movimientos. Ver detalle del mes.`}
                className={cn(
                  "group relative flex h-full flex-1 cursor-pointer flex-col justify-end rounded-md pb-6 transition-opacity duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bi-surface)]",
                  dim && "opacity-55",
                )}
              >
                {/* par de barras (2px de separación) */}
                <span className="flex h-full items-end justify-center gap-[2px]">
                  {(
                    [
                      { v: m.income, color: "var(--bi-income)" },
                      { v: m.expense, color: "var(--bi-expense)" },
                    ] as const
                  ).map((b, bi) => (
                    <span
                      key={bi}
                      aria-hidden
                      className="bi-rise w-[38%] max-w-[22px] rounded-t-[4px]"
                      style={{
                        height: `${Math.max((b.v / max) * 100, b.v > 0 ? 1.5 : 0)}%`,
                        background: b.color,
                        animationDelay: `${i * 45 + bi * 25}ms`,
                        filter: isHover ? "brightness(1.14)" : undefined,
                      }}
                    />
                  ))}
                </span>

                {/* etiqueta de mes */}
                <span
                  className={cn(
                    "bi-num absolute inset-x-0 bottom-0 text-center text-[10px] tracking-wide transition-colors",
                    isSel
                      ? "font-semibold text-[var(--bi-ink)]"
                      : "text-[var(--bi-ink-3)]",
                  )}
                >
                  {/* en angosto solo el mes: con el año no cabe y se truncaba */}
                  <span className="sm:hidden">
                    {i % pasoAngosto === 0 ? formatMonthAbbr(m.yearMonth) : ""}
                  </span>
                  <span className="hidden sm:inline">
                    {formatMonthShort(m.yearMonth)}
                  </span>
                </span>

                {/* indicador de mes seleccionado */}
                {isSel ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-1 bottom-[18px] h-[2px] rounded bg-[var(--bi-ink-2)]"
                  />
                ) : null}

                {/* tooltip */}
                {isHover ? (
                  <span
                    aria-hidden
                    className="bi-fade-up absolute bottom-[calc(100%-8px)] left-1/2 z-10 w-max -translate-x-1/2 rounded-xl border border-[var(--bi-ring)] bg-[var(--bi-surface-2)] px-3 py-2 text-left shadow-xl"
                  >
                    <span className="block text-[11px] font-semibold text-[var(--bi-ink)]">
                      {formatMonthLong(m.yearMonth)}
                    </span>
                    {(
                      [
                        { l: "Ingresos", v: m.income, c: "var(--bi-income)" },
                        { l: "Gastos", v: m.expense, c: "var(--bi-expense)" },
                        { l: "Utilidad", v: m.utilidad, c: "var(--bi-ink-2)" },
                      ] as const
                    ).map((r) => (
                      <span
                        key={r.l}
                        className="mt-1 flex items-center justify-between gap-4 text-[11px]"
                      >
                        <span className="flex items-center gap-1.5 text-[var(--bi-ink-3)]">
                          <span
                            className="size-2 rounded-[2px]"
                            style={{ background: r.c }}
                          />
                          {r.l}
                        </span>
                        <span className="bi-num text-[var(--bi-ink)]">
                          {formatCRC(r.v)}
                        </span>
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

      </div>
      <p className="mt-3 text-[11px] text-[var(--bi-ink-3)]">
        Clic en un mes para ver sus movimientos.
      </p>
    </div>
  );
}
