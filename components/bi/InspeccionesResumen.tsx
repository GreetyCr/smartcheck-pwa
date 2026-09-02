"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { formatDateCR, formatInt, formatPct } from "@/lib/bi-format";
import { BiCard } from "./BiCard";
import { BiCountBars } from "./BiCountBars";
import { BiKpiCard } from "./BiKpiCard";
import { InspeccionesPorMesChart } from "./InspeccionesPorMesChart";
import type { InspeccionesPanel } from "./types";

const pctOf = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

/**
 * Control de inspecciones realizadas — **A114**.
 *
 * Contesta las tres preguntas que pidió Esteban en una sola pantalla: **cuántas
 * van**, **en qué meses** y **quién las hizo**. El titular sale de la vista
 * unificada, o sea que es **el mismo número que la portada** — que es para lo
 * que se pidió: poder corroborar sin tener que fiarse.
 *
 * La tarjeta de técnicos es la que carga la limitación, y la dice en vez de
 * disimularla: el CRM viejo nunca registró quién hizo la revisión, así que solo
 * una parte se puede atribuir. Repartir el resto entre los dos técnicos que sí
 * existen sería inventar historia, y omitirlo haría leer sus totales como si
 * fueran todo lo que se hizo.
 */
export function InspeccionesResumen({ panel }: { panel: InspeccionesPanel }) {
  const filaTecnicos = useMemo(
    () =>
      panel.porTecnico.map((t) => ({
        key: t.technicianId,
        label: t.nombre,
        value: t.rows,
        meta: `${formatPct(pctOf(t.rows, panel.atribuibles))} · ${formatDateCR(
          t.primeraMs,
        )} – ${formatDateCR(t.ultimaMs)}`,
      })),
    [panel.porTecnico, panel.atribuibles],
  );

  /** El mes con más revisiones, para poder nombrarlo en palabras. */
  const mejorMes = useMemo(() => {
    if (panel.porMes.length === 0) return null;
    return panel.porMes.reduce((a, b) => (b.total > a.total ? b : a));
  }, [panel.porMes]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BiKpiCard
          index={0}
          label={panel.conFiltros ? "En el filtro" : "Total histórico"}
          tone="income"
          value={formatInt(panel.total)}
          /* Con un filtro puesto el titular deja de ser el histórico, así que
             el histórico pasa a `exact`: sin esa referencia, un total filtrado
             se lee como si fuera todo lo que existe. */
          exact={
            panel.conFiltros
              ? `de ${formatInt(panel.totalHistorico)} en total`
              : undefined
          }
          hint="Revisiones hechas"
        />
        <BiKpiCard
          index={1}
          label="Hechas en la app"
          tone="neutral"
          value={formatInt(panel.deLaApp)}
          exact={`${formatPct(pctOf(panel.deLaApp, panel.total))} del total`}
          hint="Con técnico y PDF"
        />
        <BiKpiCard
          index={2}
          label="Del CRM viejo"
          tone="neutral"
          value={formatInt(panel.delHistorico)}
          exact={`${formatPct(pctOf(panel.delHistorico, panel.total))} del total`}
          hint="Histórico migrado"
        />
        <BiKpiCard
          index={3}
          label="Meses con actividad"
          tone="neutral"
          value={formatInt(panel.porMes.length)}
          exact={
            mejorMes
              ? `máximo ${formatInt(mejorMes.total)} en un mes`
              : undefined
          }
          hint="Con al menos una"
        />
      </div>

      <BiCard
        className="mt-4"
        title="Revisiones por mes"
        subtitle="La altura es el total del mes; el color, de dónde sale"
      >
        <InspeccionesPorMesChart meses={panel.porMes} />
        <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-xs text-[var(--bi-ink-3)]">
          Este total es el mismo que el de la portada y el de Finanzas, porque
          sale del mismo cálculo: las dos fuentes unidas, sin la basura de prueba
          y sin contar dos veces las revisiones que quedaron en los dos lados.
          Sirve para cuadrar contra lo que muestra Leads.
        </p>
      </BiCard>

      <BiCard
        className="mt-4"
        title="Quién las hizo"
        subtitle={`Sobre las ${formatInt(panel.atribuibles)} que registran técnico`}
      >
        <BiCountBars
          rows={filaTecnicos}
          total={panel.atribuibles}
          emptyLabel="Ninguna revisión del filtro registra técnico."
        />
        {panel.sinTecnico > 0 ? (
          /* El hueco va rotulado y con su número, no repartido ni omitido: es
             la regla del hueco ruidoso (A64/A88). */
          <div className="mt-4 flex gap-2.5 border-t border-[var(--bi-ring)] pt-3">
            <Info
              className="mt-0.5 size-4 shrink-0 text-[var(--bi-ink-3)]"
              aria-hidden
            />
            <p className="text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
              Otras{" "}
              <strong className="text-[var(--bi-ink)]">
                {formatInt(panel.sinTecnico)}
              </strong>{" "}
              revisiones{" "}
              <strong>no dicen quién las hizo, y nunca lo van a decir</strong>:
              vienen del CRM viejo, que no guardaba ese dato. No es información
              pendiente de cargar — no se tomó en su momento. Por eso quedan
              aparte y no se reparten entre los técnicos de arriba, que se
              llevarían un crédito que no se puede comprobar.
            </p>
          </div>
        ) : null}
      </BiCard>
    </>
  );
}
