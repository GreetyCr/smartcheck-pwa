"use client";

import { CheckCircle2, CircleAlert, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import { formatDateCR, formatInt, formatMonthShort } from "@/lib/bi-format";
import { cn } from "@/lib/utils";
import type { ContrasteHoja } from "@/components/bi/types";

/**
 * Contraste mensual **hoja de cálculo ↔ panel** — **A56**.
 *
 * La migración financiera fue una foto y la hoja sigue viva. Ya pasó una vez:
 * julio-2026 cambió después de copiarlo y se descubrió **once días tarde**, de
 * casualidad. Esta tarjeta es el ojo que faltaba.
 *
 * ## Muestra dos cosas distintas y no las mezcla
 *
 * **1. ¿El panel y la hoja siguen diciendo lo mismo?** Es la alarma. Si un mes
 * cambió en la hoja después de copiarlo, aparece acá.
 *
 * **2. ¿La hoja cuadra consigo misma?** Salió sin buscarlo, y hoy encuentra
 * tres puntos donde la celda TOTAL de la hoja no coincide con la suma de sus
 * propias filas. **No es un problema del panel** y por eso va en su propio
 * bloque, con otro color: es información sobre la hoja de Esteban.
 *
 * ## Por qué no se dice quién tiene razón
 *
 * En dos de los tres casos se puede explicar la diferencia con la hoja a la
 * vista —una fórmula que deja fuera la última semana, otra que suma dos veces
 * un subtotal— pero en el tercero **no encontramos la fila que la explique**.
 * La tarjeta pone las dos cifras y quién las dice; decidir es de quien conoce
 * el documento.
 */
export function ContrasteHojaCard({ data }: { data: ContrasteHoja }) {
  const { meses, conDiferencia, hojaNoCuadra, corridaAt, estado } = data;
  const explicadas = meses.filter((m) => m.explicacion !== null);

  if (estado === null) {
    return (
      <BiCard
        title="Contraste con la hoja de cálculo"
        subtitle="Todavía no ha corrido"
      >
        <p className="text-[13px] leading-relaxed text-[var(--bi-ink-3)]">
          Compara mes a mes lo que hay en el panel contra la hoja. Corre solo
          los lunes; la primera corrida todavía no ocurrió.
        </p>
      </BiCard>
    );
  }

  const cabecera =
    estado === "error"
      ? {
          Icon: CircleAlert,
          color: "var(--bi-expense)",
          titulo: "No se pudo leer la hoja",
          detalle: data.mensaje ?? "Revisá que el enlace siga siendo público.",
        }
      : conDiferencia > 0
        ? {
            Icon: TriangleAlert,
            color: "var(--bi-warn)",
            titulo:
              conDiferencia === 1
                ? "Un mes dejó de coincidir con la hoja"
                : `${conDiferencia} meses dejaron de coincidir con la hoja`,
            detalle:
              "Alguien tocó ese mes en la hoja después de que lo copiáramos, o lo cambiamos acá sin anotarlo.",
          }
        : {
            Icon: CheckCircle2,
            color: "var(--bi-good)",
            titulo: `Los ${formatInt(meses.length)} meses coinciden con la hoja`,
            detalle:
              explicadas.length > 0
                ? `Incluye ${formatInt(explicadas.length)} con una diferencia que ya conocíamos y está explicada abajo.`
                : "Nada cambió desde que se copiaron.",
          };

  return (
    <BiCard
      title="Contraste con la hoja de cálculo"
      subtitle={
        corridaAt !== null
          ? `Última revisión: ${formatDateCR(corridaAt)} · corre cada lunes`
          : "Corre cada lunes"
      }
      action={
        <FileSpreadsheet
          className="size-4 shrink-0 text-[var(--bi-ink-3)]"
          aria-hidden
        />
      }
    >
      <div className="flex items-start gap-3">
        <cabecera.Icon
          className="mt-0.5 size-5 shrink-0"
          style={{ color: cabecera.color }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[var(--bi-ink)]">
            {cabecera.titulo}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
            {cabecera.detalle}
          </p>
        </div>
      </div>

      {/* ---------- meses que no coinciden ---------- */}
      {conDiferencia > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-[var(--bi-ring)] pt-4">
          {meses
            .filter((m) => m.significativo)
            .map((m) => (
              <li key={m.yearMonth} className="text-[13px]">
                <span className="bi-num font-semibold text-[var(--bi-ink)]">
                  {formatMonthShort(m.yearMonth)}
                </span>
                <span className="ml-2 text-[var(--bi-ink-2)]">
                  {[
                    Math.abs(m.difIngreso) > data.tolerancia
                      ? `ingresos ${signo(m.difIngreso, m.moneda)}`
                      : null,
                    Math.abs(m.difGasto) > data.tolerancia
                      ? `gastos ${signo(m.difGasto, m.moneda)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-[var(--bi-ink-3)]">
                  El panel contra las filas de la hoja. Un número positivo es
                  que el panel tiene de más.
                </span>
              </li>
            ))}
        </ul>
      ) : null}

      {/* ---------- diferencias ya explicadas ---------- */}
      {explicadas.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-[var(--bi-ring)] pt-4">
          {explicadas.map((m) => (
            <p
              key={m.yearMonth}
              className="text-[11.5px] leading-relaxed text-[var(--bi-ink-3)]"
            >
              <span className="bi-num font-semibold text-[var(--bi-ink-2)]">
                {formatMonthShort(m.yearMonth)}
              </span>{" "}
              — diferencia conocida de{" "}
              {signo(m.difGasto !== 0 ? m.difGasto : m.difIngreso, m.moneda)}:{" "}
              {m.explicacion}
            </p>
          ))}
        </div>
      ) : null}

      {/* ---------- la hoja contra sí misma ---------- */}
      {hojaNoCuadra.length > 0 ? (
        <div className="mt-4 border-t border-[var(--bi-ring)] pt-4">
          <p className="text-[13px] font-semibold text-[var(--bi-ink)]">
            Aparte: la hoja no cuadra consigo misma en {hojaNoCuadra.length}{" "}
            {hojaNoCuadra.length === 1 ? "punto" : "puntos"}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--bi-ink-3)]">
            En estos meses, la celda <b>TOTAL</b> de la hoja no da lo mismo que
            la suma de sus propias filas. No afecta al panel —que sigue las
            filas— pero conviene mirarlo en la hoja.
          </p>
          <ul className="mt-3 space-y-2.5">
            {hojaNoCuadra.map((h, i) => (
              <li key={`${h.yearMonth}-${h.campo}-${i}`}>
                <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                  <span className="bi-num font-semibold text-[var(--bi-ink)]">
                    {formatMonthShort(h.yearMonth)}
                  </span>
                  <span className="text-[var(--bi-ink-2)]">{h.campo}</span>
                  <span
                    className={cn(
                      "bi-num ml-auto tabular-nums",
                      h.diferencia > 0
                        ? "text-[var(--bi-warn)]"
                        : "text-[var(--bi-expense)]",
                    )}
                  >
                    {signo(h.diferencia, h.moneda)}
                  </span>
                </div>
                <p className="bi-num mt-0.5 text-[11.5px] tabular-nums text-[var(--bi-ink-3)]">
                  sus filas suman {monto(h.filas, h.moneda)} · su total dice{" "}
                  {monto(h.total, h.moneda)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-[11.5px] leading-relaxed text-[var(--bi-ink-3)]">
        Se compara en la moneda en que está escrito cada mes —la hoja usa
        dólares de septiembre a febrero— para que el tipo de cambio no meta
        ruido. Del lado del panel solo cuentan los movimientos que vinieron de
        la hoja: lo que captura la app o se anota a mano no está allá y no tiene
        por qué cuadrar.
      </p>
    </BiCard>
  );
}

/* -------------------------------------------------------------------------- */

/** `-20004` en CRC → `−₡20.004`. El signo va siempre: sin él se pierde el sentido. */
function signo(n: number, moneda: string): string {
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${s}${monto(Math.abs(n), moneda)}`;
}

function monto(n: number, moneda: string): string {
  const simbolo = moneda === "USD" ? "$" : "₡";
  const entero = Math.abs(n) >= 1000 ? Math.round(Math.abs(n)) : Math.abs(n);
  const txt = entero.toLocaleString("es-CR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${simbolo}${txt}`;
}
