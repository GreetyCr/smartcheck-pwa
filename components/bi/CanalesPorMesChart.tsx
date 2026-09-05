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
import type { CanalMes, CanalRow } from "./ChannelDashboard";

/**
 * Revisiones por mes, apiladas por canal — **A137**.
 *
 * ## Qué reemplazó, y por qué
 *
 * Antes eran **seis mini-gráficos, uno por canal, cada uno con su propia
 * escala**. El subtítulo lo advertía —«sirve para ver la tendencia de un canal,
 * no para compararlo con otro»— y esa advertencia era necesaria justamente
 * porque **el dibujo decía lo contrario**: seis filas de barras del mismo alto,
 * alineadas en la misma grilla, invitan a compararlas. Mercadeo llegaba a 72
 * revisiones al mes y Buscador a 4, y los dos dibujaban barras igual de altas.
 *
 * Una advertencia no deshace lo que el ojo ya leyó. La forma tenía que cambiar,
 * no el pie de foto.
 *
 * ## Por qué apilado
 *
 * Contesta **las dos preguntas de una vez** y con una sola escala: la altura es
 * cuántas revisiones hubo ese mes, y el reparto interno de dónde salieron. Es
 * el mismo patrón que ya funciona en Inspecciones (A114), donde hace visible el
 * traspaso del CRM viejo a la app sin que nadie tenga que explicarlo.
 *
 * ## Qué se pierde, y dónde quedó
 *
 * En una pila, un canal chico es una franja delgada y su tendencia propia se
 * lee mal. Eso lo contestaba mejor la tabla de arriba, que **ya rotula cuántos
 * meses lleva callado cada canal** — «3 MESES SIN REVISIONES» dice más sobre si
 * TikTok se apagó que cualquier barra de 4px de alto.
 *
 * ## Decisiones de la guía de dataviz
 *
 *  - **El color sigue a la entidad, no a su puesto.** Sale de `COLOR_CANAL`, un
 *    mapa por nombre: un canal no cambia de color porque otro venda más, ni
 *    porque un filtro saque a un tercero. El **orden** sí es por ingreso
 *    (`channels.ts:227`) y eso está bien —pone el canal grande al fondo, contra
 *    el eje— pero es distinto del color y conviene no confundirlos: el que no
 *    puede depender del ranking es el color, porque es lo que el lector aprende
 *    de memoria.
 *  - **Leyenda siempre presente**: con seis series la identidad no puede
 *    depender solo del color.
 *  - **2px entre segmentos**, para que el corte se vea sin depender de que dos
 *    colores contrasten entre sí.
 *  - **Sin rótulo sobre cada barra**: el valor exacto va en el tooltip y en el
 *    `aria-label` de cada mes.
 */
export function CanalesPorMesChart({
  canales,
  porMes,
  colorDe,
}: {
  /** Los canales en su orden fijo; de acá sale la leyenda y el orden de la pila. */
  canales: CanalRow[];
  porMes: CanalMes[];
  colorDe: (canal: string) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  if (porMes.length === 0 || canales.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--bi-ink-3)]">
        No hay revisiones en el periodo.
      </p>
    );
  }

  const nombres = canales.map((c) => c.canal);
  const totalDe = (m: CanalMes) =>
    m.canales.reduce((a, c) => a + (nombres.includes(c.canal) ? c.rows : 0), 0);
  const escala = Math.max(1, ...porMes.map(totalDe));

  const pasoAngosto = pasoEtiquetasMes(porMes.length, true);
  const pasoAncho = pasoEtiquetasMes(porMes.length, false);
  /* El salto se cuenta desde el final: el mes más reciente es el que se busca
     al mirar el gráfico, así que siempre se rotula (misma regla que A114). */
  const rotula = (i: number, paso: number) =>
    (porMes.length - 1 - i) % paso === 0;

  const valor = (m: CanalMes, canal: string) =>
    m.canales.find((c) => c.canal === canal)?.rows ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {canales.map((c) => (
          <span
            key={c.canal}
            className="inline-flex items-center gap-2 text-xs text-[var(--bi-ink-2)]"
          >
            <span
              aria-hidden
              className="size-2.5 rounded-[3px]"
              style={{ background: colorDe(c.canal) }}
            />
            {c.canal}
          </span>
        ))}
      </div>

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-6 top-0"
        >
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
          {porMes.map((m, i) => {
            const total = totalDe(m);
            const isHover = hover === m.ym;
            const dim = hover !== null && !isHover;
            const desglose = nombres
              .map((n) => ({ canal: n, rows: valor(m, n) }))
              .filter((x) => x.rows > 0);

            return (
              <div
                key={m.ym}
                onMouseEnter={() => setHover(m.ym)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.ym)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="img"
                aria-label={`${formatMonthLong(m.ym)}: ${formatInt(
                  total,
                )} revisiones${m.enCurso ? " (mes en curso)" : ""}. ${
                  desglose
                    .map((d) => `${d.canal} ${formatInt(d.rows)}`)
                    .join(", ") || "sin revisiones"
                }.`}
                className={cn(
                  "relative flex h-full flex-1 flex-col justify-end rounded-md pb-6 transition-opacity duration-150",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bi-surface)]",
                  dim && "opacity-55",
                )}
              >
                {/* **El canal más grande va ABAJO, pegado al eje.**
                    `justify-end` apila de arriba hacia abajo, así que se
                    recorre al revés. Importa: el segmento anclado a la línea
                    base es el único cuya altura se puede leer sin restar, y ese
                    tiene que ser el que manda —Mercadeo— no el que sobró. Los
                    canales chicos flotan arriba, que es donde su grosor se
                    compara mejor entre meses. */}
                <span className="flex h-full flex-col items-center justify-end gap-[2px]">
                  {[...nombres].reverse().map((n) => {
                    const v = valor(m, n);
                    if (v === 0) return null;
                    return (
                      <span
                        key={n}
                        aria-hidden
                        className="w-full rounded-[3px]"
                        style={{
                          height: `${Math.max((v / escala) * 100, 1.2)}%`,
                          background: colorDe(n),
                          /* El mes en curso va traslúcido: está a medio llenar
                             y leerlo como una caída sería un error caro. */
                          opacity: m.enCurso ? 0.55 : undefined,
                        }}
                      />
                    );
                  })}
                </span>

                {/* Tooltip: el desglose completo del mes, que es lo que la pila
                    no puede dar leyendo alturas. */}
                {isHover ? (
                  <div
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-1 w-max max-w-[190px] rounded-lg border border-[var(--bi-ring)] bg-[var(--bi-surface-2)] px-2.5 py-2 shadow-lg",
                      /* Anclado por tercios: pegado al borde en los extremos,
                         centrado en el medio. Centrarlo siempre lo sacaba de la
                         tarjeta en el primer y el último mes. */
                      i < porMes.length / 3
                        ? "left-0"
                        : i > (porMes.length * 2) / 3
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    <p className="text-[11.5px] font-semibold text-[var(--bi-ink)]">
                      {formatMonthLong(m.ym)}
                      {m.enCurso ? " · en curso" : ""}
                    </p>
                    <p className="bi-num mt-0.5 text-[11px] text-[var(--bi-ink-2)]">
                      {formatInt(total)} revisiones
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {desglose.map((d) => (
                        <li
                          key={d.canal}
                          className="flex items-center gap-1.5 text-[11px] text-[var(--bi-ink-2)]"
                        >
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-[2px]"
                            style={{ background: colorDe(d.canal) }}
                          />
                          <span className="truncate">{d.canal}</span>
                          <span className="bi-num ml-auto tabular-nums">
                            {formatInt(d.rows)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <span className="absolute inset-x-0 bottom-0 text-center">
                  <span className="bi-num text-[9.5px] uppercase tabular-nums text-[var(--bi-ink-3)] sm:hidden">
                    {rotula(i, pasoAngosto) ? formatMonthAbbr(m.ym) : ""}
                  </span>
                  <span className="bi-num hidden whitespace-nowrap text-[10px] uppercase tabular-nums text-[var(--bi-ink-3)] sm:inline">
                    {rotula(i, pasoAncho) ? formatMonthShort(m.ym) : ""}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
