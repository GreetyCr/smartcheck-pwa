"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatInt,
  formatMonthAbbr,
  formatMonthLong,
  formatMonthShort,
  formatPct,
  pasoEtiquetasMes,
} from "@/lib/bi-format";
import type { ConversionPorMes } from "./types";

/**
 * Conversión por **cohorte de mes**: de los leads que llegaron en cada mes,
 * qué porcentaje terminó siendo una revisión pagada — **A113**.
 *
 * ## Por qué existe
 *
 * Esta pantalla mostraba un solo número de toda la vida (2,54%) y Esteban lo
 * leyó como que el negocio no mejoraba. No mejoraba **el promedio**: con ~1.000
 * leads nuevos por mes contra nueve meses acumulados, el denominador crece tan
 * rápido como el numerador y la fracción no se mueve por buena que sea la
 * racha. Cortado por mes, lo que en realidad pasó es que la conversión subió de
 * 0,32% a 6,23%. El promedio no estaba mal calculado: estaba contestando otra
 * pregunta.
 *
 * ## Decisiones de la guía de dataviz
 *
 *  - **Un solo eje, y es la tasa.** La tentación era dibujar también el volumen
 *    de leads, pero son dos medidas de escalas distintas y un gráfico de dos
 *    ejes deja que la relación entre las series la fabrique el escalado. El
 *    volumen va al tooltip y al `aria-label`, donde se lee exacto.
 *  - **Una serie → sin leyenda**: el título la nombra. La leyenda es para
 *    cuando hay identidad que distinguir.
 *  - **Rótulo directo solo en el último mes**, que es donde está el argumento;
 *    el resto se lee en hover. Un número sobre cada barra convierte el gráfico
 *    en una tabla peor formateada.
 *  - Marcas delgadas con el extremo redondeado 4px apoyado en la línea base, y
 *    rejilla/ejes recesivos — el mismo idioma que `BiMonthlyBars`.
 *
 * ## El mes en curso
 *
 * Va **atenuado y rotulado**, no oculto ni maquillado: sus leads todavía tienen
 * tiempo de convertir (la mediana de lead→revisión es de 4 días y el 78% cae
 * dentro de 30), así que su barra sube después. Pintarlo como definitivo haría
 * leer una caída donde solo falta calendario — el mismo error que evita alinear
 * los presets al inicio de mes en `lib/bi-filtros.ts`.
 */
export function ConversionPorMesChart({
  meses,
  mesEnCurso,
}: {
  meses: ConversionPorMes[];
  mesEnCurso?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  if (meses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--bi-ink-3)]">
        No hay contactos en el periodo seleccionado.
      </p>
    );
  }

  /**
   * La escala es el **máximo de los datos**, no 100% y sin factor de aire.
   *
   * Dos decisiones en una línea:
   *
   *  - **Contra los datos y no contra 100**: con tasas de 0 a 7% un eje a 100
   *    aplasta todas las barras contra la línea base y la mejora —que es justo
   *    lo que hay que ver— se vuelve invisible. El eje va rotulado, así que dice
   *    hasta dónde llega y no hay engaño.
   *  - **Sin aire añadido**: el espacio del rótulo directo se reserva con un
   *    `pt-6` en el área de trazado. Inflar la escala obliga a adivinar la
   *    altura del texto y se queda corto en cuanto cambia la tipografía —medido:
   *    un 12% dejaba 18,9px para un rótulo de 20,5px y se salía 1,6px—. Con la
   *    banda reservada arriba, la barra más alta llega justo al borde superior
   *    del área y el rótulo vive en su propio espacio.
   */
  const escala = Math.max(1, ...meses.map((m) => m.tasaPct));
  const ultimo = meses[meses.length - 1];
  const pasoAngosto = pasoEtiquetasMes(meses.length, true);
  /* Hoy son 10 meses y en escritorio entran de sobra, pero la serie crece un
     mes por mes: al llegar a 13 se parte igual que se partía la de
     inspecciones. La regla es la misma para las dos. */
  const pasoAncho = pasoEtiquetasMes(meses.length, false);
  /* El salto se cuenta **desde el final**, no desde el principio: con 18
     meses y paso 2 el último quedaba sin rótulo, y el mes más reciente es
     justo el que se busca al mirar el gráfico. Anclado atrás, el último
     siempre se escribe y los que se saltan quedan en el medio. */
  const rotula = (i: number, paso: number) =>
    (meses.length - 1 - i) % paso === 0;

  return (
    <div>
      <div className="relative">
        {/* rejilla recesiva + escala */}
        {/* misma caja que las barras: `top-6` (banda del rótulo) y `bottom-6`
            (fila de meses), para que la línea del máximo caiga en su punta */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-6 top-6"
        >
          {[escala, escala / 2].map((v) => (
            <div
              key={v}
              /* `-translate-y-1/2`: sin esto la fila se ancla por su borde
                 superior y la línea, centrada en sus 15px de alto, queda 7,5px
                 por debajo del valor que rotula — medido. Con media altura de
                 corrección la línea del máximo cae exactamente en la punta de la
                 barra más alta, que es lo que promete la escala. */
              className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2"
              style={{ top: `${(1 - v / escala) * 100}%` }}
            >
              <span className="bi-num w-10 shrink-0 text-right text-[10px] text-[var(--bi-ink-3)]">
                {formatPct(v, v < 10 ? 1 : 0)}
              </span>
              <span className="h-px flex-1 bg-[var(--bi-grid)]" />
            </div>
          ))}
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-6 left-12 h-px bg-[var(--bi-axis)]"
        />

        {/* área de trazado */}
        {/* `pt-6` = la banda del rótulo directo, reservada por construcción */}
        <div className="relative flex h-[200px] items-end gap-1.5 pl-12 pt-6 sm:gap-2">
          {meses.map((m, i) => {
            const isHover = hover === m.yearMonth;
            const dim = hover !== null && !isHover;
            const enCurso = m.yearMonth === mesEnCurso;
            const esUltimo = m.yearMonth === ultimo.yearMonth;
            return (
              <div
                key={m.yearMonth}
                onMouseEnter={() => setHover(m.yearMonth)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.yearMonth)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="img"
                aria-label={`${formatMonthLong(m.yearMonth)}: ${formatPct(
                  m.tasaPct,
                  2,
                )} de conversión — ${formatInt(m.convertidos)} de ${formatInt(
                  m.leads,
                )} contactos${
                  m.recompras > 0
                    ? `, más ${formatInt(m.recompras)} de recompra que no cuentan`
                    : ""
                }.${enCurso ? " Mes en curso: la cifra todavía va a subir." : ""}`}
                className={cn(
                  "group relative flex h-full flex-1 flex-col justify-end rounded-md pb-6 transition-opacity duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bi-surface)]",
                  dim && "opacity-55",
                )}
              >
                <span className="flex h-full flex-col items-center justify-end">
                  {/* Rótulo directo del último mes: hermano de la barra en la
                      columna flex —así se pega arriba sea cual sea la altura, sin
                      factor de corrección— pero dentro de una caja de **0×0**.

                      Lo de 0×0 no es adorno. Medido a 375px: con el rótulo en el
                      flujo su casilla pasaba a 26,4px contra 20,1px de las otras
                      nueve, porque el texto empujaba el `min-content` de su
                      columna flex. La última barra quedaba 31% más ancha que el
                      resto —justo la que carga el argumento— y a ojo no se nota.
                      Con la caja en cero el texto desborda centrado y la reja
                      vuelve a ser pareja; el `pt-6` del área le da el lugar
                      vertical. */}
                  {esUltimo && !hover ? (
                    <span aria-hidden className="relative h-0 w-0">
                      <span className="bi-num absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-[var(--bi-ink)]">
                        {formatPct(m.tasaPct, 1)}
                      </span>
                    </span>
                  ) : null}
                  <span
                    aria-hidden
                    className={cn(
                      "bi-rise w-[62%] max-w-[26px] rounded-t-[4px]",
                      enCurso && "opacity-60",
                    )}
                    style={{
                      height: `${Math.max(
                        (m.tasaPct / escala) * 100,
                        m.tasaPct > 0 ? 1.5 : 0,
                      )}%`,
                      background: "var(--bi-income)",
                      animationDelay: `${i * 45}ms`,
                      filter: isHover ? "brightness(1.14)" : undefined,
                      /* El mes incompleto se distingue también sin color: rayado
                         a 45°, para daltonismo, impresión y forced-colors. */
                      backgroundImage: enCurso
                        ? "repeating-linear-gradient(45deg, rgba(255,255,255,.28) 0 2px, transparent 2px 5px)"
                        : undefined,
                    }}
                  />
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
                      /* Centrado siempre, el tooltip de la última barra se salía
                         27px por la derecha a 375px —medido— y agosto es
                         justamente la barra que hay que poder leer. En los
                         tercios de los extremos se ancla al borde de su propia
                         barra en vez de centrarse. */
                      i < meses.length / 3
                        ? "left-0"
                        : i >= (meses.length * 2) / 3
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    <p className="text-[11px] font-medium text-[var(--bi-ink)]">
                      {formatMonthLong(m.yearMonth)}
                      {enCurso ? " · en curso" : ""}
                    </p>
                    <p className="bi-num mt-1 text-[13px] font-semibold text-[var(--bi-income)]">
                      {formatPct(m.tasaPct, 2)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--bi-ink-2)]">
                      {formatInt(m.convertidos)} de {formatInt(m.leads)}{" "}
                      contactos
                    </p>
                    {m.recompras > 0 ? (
                      <p className="mt-0.5 text-[11px] text-[var(--bi-ink-3)]">
                        + {formatInt(m.recompras)} de recompra (no cuentan)
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {mesEnCurso && meses.some((m) => m.yearMonth === mesEnCurso) ? (
        <p className="mt-3 text-[11px] text-[var(--bi-ink-3)]">
          La última barra va rayada porque el mes no ha cerrado: esos contactos
          todavía tienen tiempo de convertir, así que la cifra sube después.
        </p>
      ) : null}
    </div>
  );
}
