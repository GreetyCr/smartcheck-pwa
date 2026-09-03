"use client";

import { AlertTriangle, Clock, Gauge, Wrench } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import { BiKpiCard } from "@/components/bi/BiKpiCard";
import { formatInt, formatMonthShort, formatPct } from "@/lib/bi-format";
import { cn } from "@/lib/utils";
import type { Operacion } from "@/components/bi/types";

/**
 * Hallazgos, condición y tiempos de respuesta — **RF-07**.
 *
 * Es el requerimiento que dábamos por entregado y no lo estaba: el tablero que
 * salió con el nombre «Calidad» mide **calidad de los datos** (duplicados,
 * avisos del BI) y RF-07 pide **calidad y operación del servicio**. Por eso
 * este es una pantalla aparte y no un bloque dentro de aquella — juntarlos
 * volvería a mezclar las dos cosas que la auditoría separó.
 *
 * ## Lo que hay que leer bien
 *
 * **Cada porcentaje tiene su propio denominador, y está escrito al lado.** El
 * de un ítem va sobre las veces que ese ítem *se evaluó*, no sobre las 144
 * revisiones: «Nivel de coolant, 33 de 101» es distinto de «33 de 144», y la
 * segunda lectura haría ver el problema más chico de lo que es. El de la
 * condición va sobre las que tienen el dato anotado. El del SLA, sobre las que
 * tienen las dos fechas — que **no son todas**, y eso se dice con número.
 *
 * **El SLA es el indicador más frágil de esta pantalla** y por eso su tarjeta
 * arranca diciendo sobre cuántas se pudo calcular. Presentar «mediana 4,1 h»
 * sin decir que sale de 93 de 142 sería exacto y engañoso a la vez.
 */
export function OperacionDashboard({ data }: { data: Operacion }) {
  const { revisiones, condicion, hallazgos, sla } = data;
  const coberturaSla =
    sla.entregadas > 0 ? (sla.medibles / sla.entregadas) * 100 : 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
          Hallazgos y tiempos
        </h1>
        <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          {formatInt(revisiones.conChecklist)} revisiones con checklist ·{" "}
          {formatInt(hallazgos.total)} hallazgos
        </p>
        {/* **De qué universo habla esta pantalla — A126.**
            No lo decía en ningún lado, y el número más grande del panel son 906
            revisiones. Un lector razonable asume que estos hallazgos salen de
            todas; salen solo de las hechas en la app, porque el CRM viejo no
            guardaba checklist. Es el mismo riesgo que hizo comparar mal tres
            pantallas el 2-set (B44): una cifra sin su universo al lado invita a
            cruzarla con la que no corresponde. */}
        <p className="mt-2 text-[12px] text-[var(--bi-ink-3)]">
          Solo las revisiones <strong>hechas en la app</strong>: son las únicas
          con checklist, fecha de entrega y condición anotada. Las del CRM viejo
          no guardaban nada de eso, así que no aparecen acá — el total de
          revisiones de todo el histórico vive en Inspecciones.
        </p>
      </header>

      {/* ---------- KPIs ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BiKpiCard
          index={0}
          label="Hallazgos por revisión"
          tone="warn"
          value={hallazgos.promedioPorRevision.toLocaleString("es-CR")}
          hint={`${formatInt(hallazgos.total)} en total`}
        />
        <BiKpiCard
          index={1}
          label="Sin un solo hallazgo"
          tone="utilidad"
          value={formatInt(hallazgos.sinHallazgos)}
          hint={`de ${formatInt(hallazgos.evaluadas)} revisadas`}
        />
        <BiKpiCard
          index={2}
          label="Entrega del informe"
          tone="income"
          value={`${sla.medianaHoras.toLocaleString("es-CR")} h`}
          hint={`típico · ${formatInt(sla.medibles)} medibles`}
        />
        <BiKpiCard
          index={3}
          label="Entregadas en 24 h"
          tone="neutral"
          value={formatPct(
            sla.medibles > 0 ? (sla.dentroDe24h / sla.medibles) * 100 : 0,
          )}
          hint={`${formatInt(sla.dentroDe24h)} de ${formatInt(sla.medibles)}`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        {/* ---------- lo que más sale ---------- */}
        <BiCard
          title="Lo que más aparece"
          subtitle="Sobre las veces que cada punto se revisó, no sobre el total"
          action={
            <Wrench className="size-4 shrink-0 text-[var(--bi-ink-3)]" aria-hidden />
          }
        >
          {hallazgos.top.length === 0 ? (
            <p className="text-[13px] text-[var(--bi-ink-3)]">
              Todavía no hay suficientes revisiones para armar el ranking.
            </p>
          ) : (
            <ul className="space-y-3">
              {hallazgos.top.map((r, i) => (
                <li key={`${r.seccion}.${r.item}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] text-[var(--bi-ink)]">
                        {r.itemEtiqueta}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--bi-ink-3)]">
                        {r.seccionEtiqueta}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="bi-num block text-[13px] tabular-nums text-[var(--bi-ink)]">
                        {formatPct(r.pct)}
                      </span>
                      {/* El «de N» va SIEMPRE al lado del porcentaje: sin él,
                          «57,7%» de 71 evaluaciones y «57,7%» de 144 se leen
                          igual y no lo son. */}
                      <span className="bi-num block text-[11px] tabular-nums text-[var(--bi-ink-3)]">
                        {formatInt(r.hallazgos)} de {formatInt(r.evaluados)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
                    <div
                      className="bi-grow-x h-full rounded-full"
                      style={{
                        width: `${Math.max(r.pct, 2)}%`,
                        background: "var(--bi-warn)",
                        animationDelay: `${i * 40}ms`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {hallazgos.fueraDelRanking > 0 ? (
            <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-[11.5px] leading-relaxed text-[var(--bi-ink-3)]">
              Quedaron fuera <b>{formatInt(hallazgos.fueraDelRanking)}</b> puntos
              con menos de {hallazgos.minEvaluaciones} revisiones. Con tan pocas,
              uno solo daría 100% y encabezaría la lista sin querer decir nada.
            </p>
          ) : null}

          {hallazgos.itemsSinCatalogar.length > 0 ? (
            <p className="mt-2 flex items-start gap-2 text-[11.5px] leading-relaxed text-[var(--bi-warn)]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Hay puntos del formulario sin describir en el catálogo, así que
                no se están contando: {hallazgos.itemsSinCatalogar.join(", ")}.
                Avisanos.
              </span>
            </p>
          ) : null}
        </BiCard>

        <div className="space-y-4">
          {/* ---------- condición ---------- */}
          <BiCard
            title="Cómo llegan los carros"
            subtitle={`Según lo que anota el técnico · ${formatInt(
              revisiones.total - condicion.sinDato,
            )} con dato`}
            action={
              <Gauge className="size-4 shrink-0 text-[var(--bi-ink-3)]" aria-hidden />
            }
          >
            <ul className="space-y-3">
              {condicion.niveles.map((n) => (
                <li key={n.nivel}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px] text-[var(--bi-ink)]">
                      {n.etiqueta}
                    </span>
                    <span className="bi-num shrink-0 text-[13px] tabular-nums text-[var(--bi-ink)]">
                      {formatPct(n.pct)}{" "}
                      <span className="text-[var(--bi-ink-3)]">
                        ({formatInt(n.rows)})
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
                    <div
                      className="bi-grow-x h-full rounded-full"
                      style={{
                        width: `${Math.max(n.pct, 1)}%`,
                        background: COLOR_CONDICION[n.nivel] ?? "var(--bi-ink-3)",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {condicion.sinDato > 0 ? (
              <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-[11.5px] text-[var(--bi-ink-3)]">
                <b>{formatInt(condicion.sinDato)}</b> revisiones no traen esta
                nota. Los porcentajes van sobre las que sí.
              </p>
            ) : null}
          </BiCard>

          {/* ---------- por sección ---------- */}
          <BiCard
            title="Qué parte del carro falla más"
            subtitle="Revisiones con al menos un hallazgo en esa parte"
          >
            <ul className="space-y-2.5">
              {data.hallazgos.porSeccion.slice(0, 8).map((s) => (
                <li key={s.seccion}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] text-[var(--bi-ink-2)]">
                      {s.etiqueta}
                    </span>
                    <span className="bi-num shrink-0 text-[12.5px] tabular-nums text-[var(--bi-ink)]">
                      {formatPct(s.pct)}
                    </span>
                  </div>
                  <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
                    <div
                      className="bi-grow-x h-full rounded-full"
                      style={{
                        width: `${Math.max(s.pct, 2)}%`,
                        background: "var(--bi-expense)",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </BiCard>
        </div>
      </div>

      {/* ---------- SLA ---------- */}
      <div className="mt-4">
        <BiCard
          title="Cuánto se tarda en entregar el informe"
          subtitle="Desde que arranca la revisión hasta que el informe sale"
          action={
            <Clock className="size-4 shrink-0 text-[var(--bi-ink-3)]" aria-hidden />
          }
        >
          {/* La cobertura va PRIMERO. «Mediana 4,1 h» sin decir que sale de 93
              de 142 es exacto y engañoso a la vez. */}
          <p
            className={cn(
              "text-[13px] leading-relaxed",
              coberturaSla < 80
                ? "text-[var(--bi-warn)]"
                : "text-[var(--bi-ink-2)]",
            )}
          >
            {sla.medibles === 0 ? (
              <>
                <b>No se puede medir todavía.</b> Ninguna de las{" "}
                {formatInt(sla.entregadas)} revisiones entregadas tiene fecha de
                inicio, y sin ella no hay desde cuándo contar.
              </>
            ) : (
              <>
                Se puede medir en <b>{formatInt(sla.medibles)}</b> de las{" "}
                {formatInt(sla.entregadas)} entregadas.{" "}
                {sla.sinFechaInicio > 0 ? (
                  <>
                    Las otras <b>{formatInt(sla.sinFechaInicio)}</b> no tienen
                    fecha de inicio anotada — son de la época en que ese dato no
                    se guardaba, y no se pueden recuperar.
                  </>
                ) : null}
              </>
            )}
          </p>

          {sla.medibles > 0 ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[var(--bi-ring)] pt-4 sm:grid-cols-4">
                <Dato
                  etiqueta="Lo normal"
                  valor={`${sla.medianaHoras.toLocaleString("es-CR")} h`}
                  pista="la mitad tarda menos"
                />
                <Dato
                  etiqueta="Las lentas"
                  valor={`${sla.p90Horas.toLocaleString("es-CR")} h`}
                  pista="1 de cada 10 tarda más"
                />
                <Dato
                  etiqueta="La más lenta"
                  valor={`${sla.maxHoras.toLocaleString("es-CR")} h`}
                  pista="el peor caso"
                />
                <Dato
                  etiqueta="En 48 h"
                  valor={formatPct((sla.dentroDe48h / sla.medibles) * 100)}
                  pista={`${formatInt(sla.dentroDe48h)} de ${formatInt(sla.medibles)}`}
                />
              </div>

              {sla.porMes.length > 0 ? (
                <div className="mt-4 border-t border-[var(--bi-ring)] pt-4">
                  <p className="mb-3 text-[12px] text-[var(--bi-ink-3)]">
                    Mes a mes, lo que tarda una revisión normal:
                  </p>
                  <ul className="space-y-2.5">
                    {sla.porMes.map((m) => {
                      const max = Math.max(
                        ...sla.porMes.map((x) => x.medianaHoras),
                        1,
                      );
                      return (
                        <li key={m.ym}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="bi-num text-[12.5px] text-[var(--bi-ink-2)]">
                              {formatMonthShort(m.ym)}
                              <span className="ml-2 text-[11px] text-[var(--bi-ink-3)]">
                                {formatInt(m.rows)} revisiones
                              </span>
                            </span>
                            <span className="bi-num shrink-0 text-[12.5px] tabular-nums text-[var(--bi-ink)]">
                              {m.medianaHoras.toLocaleString("es-CR")} h
                            </span>
                          </div>
                          <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
                            <div
                              className="bi-grow-x h-full rounded-full"
                              style={{
                                width: `${Math.max((m.medianaHoras / max) * 100, 2)}%`,
                                background: "var(--bi-income)",
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {sla.inconsistentes > 0 ? (
            <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-[var(--bi-warn)]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                <b>{formatInt(sla.inconsistentes)}</b>{" "}
                {sla.inconsistentes === 1 ? "revisión figura" : "revisiones figuran"}{" "}
                con el informe entregado <b>antes</b> de haber empezado. Se
                dejaron fuera del cálculo. Avisanos para revisarlas.
              </span>
            </p>
          ) : null}
        </BiCard>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const COLOR_CONDICION: Record<number, string> = {
  1: "var(--bi-good)",
  2: "var(--bi-warn)",
  3: "var(--bi-expense)",
};

function Dato({
  etiqueta,
  valor,
  pista,
}: {
  etiqueta: string;
  valor: string;
  pista: string;
}) {
  return (
    <div className="min-w-0">
      <p className="bi-num text-[10px] uppercase tracking-[0.12em] text-[var(--bi-ink-3)]">
        {etiqueta}
      </p>
      <p className="mt-1 text-[20px] font-semibold leading-none text-[var(--bi-ink)]">
        {valor}
      </p>
      <p className="mt-1 truncate text-[11px] text-[var(--bi-ink-3)]">{pista}</p>
    </div>
  );
}
