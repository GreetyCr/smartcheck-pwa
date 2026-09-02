"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatInt,
  formatMonthAbbr,
  formatMonthLong,
  formatMonthShort,
  pasoEtiquetasMes,
} from "@/lib/bi-format";
import type { InspeccionMes } from "./types";

/**
 * Revisiones por mes, apiladas por origen — **A114**.
 *
 * ## Por qué apilado y no agrupado
 *
 * La pregunta es «cuántas se hicieron en cada mes»; de dónde salen es la
 * respuesta secundaria. Apilado, la altura **es** el total y la composición se
 * lee dentro; agrupado obligaría a sumar dos barras con la vista para contestar
 * lo primero. Es también lo que hace visible el traspaso: el histórico del CRM
 * se apaga y la app lo reemplaza, sin que el total se caiga.
 *
 * ## Decisiones de la guía de dataviz
 *
 *  - **Dos series → leyenda siempre presente**: la identidad no puede depender
 *    solo del color.
 *  - **Orden fijo por entidad, nunca por tamaño**: «de la app» es siempre el
 *    primer color y «del CRM viejo» el segundo, aunque un mes se den vuelta. Si
 *    el color siguiera al ranking, filtrar repintaría el gráfico entero.
 *  - Los dos colores son los que el sistema ya declara como serie categórica en
 *    orden fijo (`--bi-income`, `--bi-expense`), con sus seis comprobaciones de
 *    daltonismo y contraste ya hechas. Los nombres son históricos; acá no
 *    significan ingreso ni gasto.
 *  - **2px de separación entre los dos segmentos**, para que el corte se vea sin
 *    depender de que los colores contrasten entre sí.
 *  - Sin rótulo sobre cada barra: el valor exacto va en el tooltip y en el
 *    `aria-label` de cada mes.
 */
export function InspeccionesPorMesChart({ meses }: { meses: InspeccionMes[] }) {
  const [hover, setHover] = useState<string | null>(null);

  if (meses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--bi-ink-3)]">
        No hay revisiones con los filtros puestos.
      </p>
    );
  }

  const escala = Math.max(1, ...meses.map((m) => m.total));
  const pasoAngosto = pasoEtiquetasMes(meses.length, true);
  const pasoAncho = pasoEtiquetasMes(meses.length, false);
  /* El salto se cuenta **desde el final**, no desde el principio: con 18
     meses y paso 2 el último quedaba sin rótulo, y el mes más reciente es
     justo el que se busca al mirar el gráfico. Anclado atrás, el último
     siempre se escribe y los que se saltan quedan en el medio. */
  const rotula = (i: number, paso: number) =>
    (meses.length - 1 - i) % paso === 0;

  const SERIES = [
    { key: "app", label: "Hechas en la app", color: "var(--bi-income)" },
    { key: "legacy", label: "Del CRM viejo", color: "var(--bi-expense)" },
  ] as const;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {SERIES.map((s) => (
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
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-6 top-0">
          {[escala, escala / 2].map((v) => (
            <div
              key={v}
              className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2"
              style={{ top: `${(1 - v / escala) * 100}%` }}
            >
              <span className="bi-num w-10 shrink-0 text-right text-[10px] text-[var(--bi-ink-3)]">
                {formatInt(Math.round(v))}
              </span>
              <span className="h-px flex-1 bg-[var(--bi-grid)]" />
            </div>
          ))}
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-6 left-12 h-px bg-[var(--bi-axis)]"
        />

        <div className="relative flex h-[200px] items-end gap-1.5 pl-12 sm:gap-2">
          {meses.map((m, i) => {
            const isHover = hover === m.yearMonth;
            const dim = hover !== null && !isHover;
            return (
              <div
                key={m.yearMonth}
                onMouseEnter={() => setHover(m.yearMonth)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.yearMonth)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="img"
                aria-label={`${formatMonthLong(m.yearMonth)}: ${formatInt(
                  m.total,
                )} revisiones — ${formatInt(m.app)} hechas en la app y ${formatInt(
                  m.legacy,
                )} del CRM viejo.`}
                className={cn(
                  "relative flex h-full flex-1 flex-col justify-end rounded-md pb-6 transition-opacity duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bi-surface)]",
                  dim && "opacity-55",
                )}
              >
                {/* La pila: app arriba, CRM viejo abajo. `gap-[2px]` es el
                    separador entre segmentos; sin él, dos meses con la misma
                    mezcla se leen como una sola barra continua. */}
                <span className="flex h-full flex-col justify-end items-center gap-[2px]">
                  {SERIES.map((s) => {
                    const v = s.key === "app" ? m.app : m.legacy;
                    if (v === 0) return null;
                    return (
                      <span
                        key={s.key}
                        aria-hidden
                        className={cn(
                          "bi-rise w-[62%] max-w-[26px]",
                          s.key === "app" && "rounded-t-[4px]",
                        )}
                        style={{
                          height: `${Math.max((v / escala) * 100, 1.5)}%`,
                          background: s.color,
                          animationDelay: `${i * 45}ms`,
                          filter: isHover ? "brightness(1.14)" : undefined,
                        }}
                      />
                    );
                  })}
                </span>

                {/* `whitespace-nowrap`: la caja del rótulo mide **una** casilla, así que
    saltar meses reparte el espacio pero no ensancha la caja — sin esto,
    «MAY 25» se sigue partiendo en dos líneas dentro de sus 25,5px aunque
    el vecino esté vacío. Con nowrap desborda centrado hacia los huecos
    que el salto acaba de dejar libres, que es de donde sale el espacio. */}
                <span className="bi-num absolute inset-x-0 bottom-0 whitespace-nowrap text-center text-[10px] tracking-wide text-[var(--bi-ink-3)]">
                  <span className="sm:hidden">
                    {rotula(i, pasoAngosto) ? formatMonthAbbr(m.yearMonth) : ""}
                  </span>
                  <span className="hidden sm:inline">
                    {rotula(i, pasoAncho) ? formatMonthShort(m.yearMonth) : ""}
                  </span>
                </span>

                {isHover ? (
                  <div
                    className={cn(
                      "bi-fade-up pointer-events-none absolute bottom-8 z-10 w-max rounded-lg border border-[var(--bi-ring)] bg-[var(--bi-surface-2)] px-3 py-2 text-left shadow-lg",
                      /* Mismo anclaje por tercios que el gráfico de conversión:
                         centrado siempre, el tooltip del último mes se sale por
                         la derecha en pantalla angosta. */
                      i < meses.length / 3
                        ? "left-0"
                        : i >= (meses.length * 2) / 3
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    <p className="text-[11px] font-medium text-[var(--bi-ink)]">
                      {formatMonthLong(m.yearMonth)}
                    </p>
                    <p className="bi-num mt-1 text-[13px] font-semibold text-[var(--bi-ink)]">
                      {formatInt(m.total)} revisiones
                    </p>
                    {SERIES.map((s) => {
                      const v = s.key === "app" ? m.app : m.legacy;
                      if (v === 0) return null;
                      return (
                        <p
                          key={s.key}
                          className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--bi-ink-2)]"
                        >
                          <span
                            aria-hidden
                            className="size-2 rounded-[2px]"
                            style={{ background: s.color }}
                          />
                          {formatInt(v)} {s.label.toLowerCase()}
                        </p>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
