"use client";

import { BiCard } from "@/components/bi/BiCard";
import { BiKpiCard } from "@/components/bi/BiKpiCard";
import { BiMonthlyBars } from "@/components/bi/BiMonthlyBars";
import { PERIODOS, type PeriodoKey } from "@/components/bi/ExpenseGroupsCard";
import {
  formatCompactCRC,
  formatCRC,
  formatInt,
  formatPct,
  variacion,
} from "@/lib/bi-format";
import { cn } from "@/lib/utils";
import type {
  ChannelMixRow,
  ExecutiveSummary,
  FinanceMonth,
} from "@/components/bi/types";

/**
 * Resumen ejecutivo — **RF-03**: total de revisiones (histórico) + KPIs del
 * periodo + tendencia + mezcla de canales.
 *
 * El cálculo estaba en producción y probado desde antes (`bi/public.js:
 * executiveSummary`, 21 pruebas en `tests/convex/metrics.test.ts`) y **no lo
 * leía nadie**: la portada mostraba `admin:getDashboardMetrics`, que es el
 * operativo de la PWA —inspecciones de hoy, sin sincronizar, técnicos activos—
 * y no el resumen del negocio. Esto es la pantalla que faltaba.
 *
 * ## La decisión que sostiene el diseño: dos alcances, dos bloques
 *
 * En esta pantalla conviven números de **dos alcances distintos** y mezclarlos
 * sería la forma más fácil de mentir:
 *
 *  - **Del periodo** — ingresos, gastos, utilidad y margen salen de
 *    `finance_entries` filtrado por el rango. Se mueven al tocar el selector.
 *  - **Del histórico completo** — leads, convertidos y la tasa de conversión
 *    salen de `leads_contacts` y `bi_matches`, que el backend lee **enteros**.
 *    No se mueven, y no es un olvido: una conversión acotada a un periodo
 *    mezcla cohortes —un lead de marzo que compra en agosto— y puede pasar del
 *    100%.
 *
 * Por eso van en **dos filas rotuladas** y no en una sola tanda de tarjetas con
 * una nota al pie. Un filtro que se ignora en silencio es peor que no tenerlo
 * (A64); acá no se ignora, se dice de qué es cada número.
 *
 * ## Los dos ingresos
 *
 * El KPI de ingresos es el del **P&L** (`finance_entries`, A16). La mezcla de
 * canales reparte los ingresos de las **revisiones**, que es otro número y más
 * bajo. No cuadran y no tienen por qué: hay ingresos que no son revisiones. La
 * tarjeta de canales lo rotula en su subtítulo en vez de dejar al lector
 * descubriendo la diferencia con una resta.
 */
export function ResumenEjecutivo({
  periodo,
  historico,
  anterior,
  meses,
  canales,
  periodoKey,
  onPeriodo,
  filtrosGlobales = 0,
}: {
  /** Cifras acotadas al periodo elegido. */
  periodo: ExecutiveSummary;
  /** Las mismas cifras sin filtro. De acá salen los totales históricos. */
  historico: ExecutiveSummary;
  /**
   * Las mismas cifras del **periodo inmediatamente anterior**, del mismo largo
   * (A135). `undefined` mientras carga y `null` cuando no hay con qué comparar
   * —el preset «Todo» no tiene un antes—; en los dos casos no se pinta
   * variación, que es distinto de pintar un 0%.
   */
  anterior?: ExecutiveSummary | null;
  /** Serie mensual del periodo, para la tendencia. */
  meses: FinanceMonth[];
  /** Mezcla de canales del periodo. */
  canales: ChannelMixRow[];
  periodoKey: PeriodoKey;
  onPeriodo: (p: PeriodoKey) => void;
  /**
   * Cuántos filtros de la barra global hay puestos.
   *
   * Importa porque **los números de contactos y conversión no respetan ningún
   * filtro**, ni el periodo ni los de la barra: el backend lee `leads_contacts`
   * y `bi_matches` enteros. Con un filtro de marca puesto, la fila de arriba se
   * angosta y la de abajo no — y sin decirlo, eso se lee como un error.
   */
  filtrosGlobales?: number;
}) {
  const hayPeriodo = periodoKey !== "todo";
  const hayDimension = (filtrosGlobales ?? 0) > 0;
  const hayFiltro = hayPeriodo || hayDimension;
  const etiquetaPeriodo =
    PERIODOS.find((p) => p.key === periodoKey)?.label ?? "Todo";
  /**
   * Con qué se compara, **nombrado**. «vs anterior» deja al lector preguntando
   * anterior a qué; «vs los 3 previos» lo dice (A135).
   */
  const contraPeriodo = `vs los ${etiquetaPeriodo
    .toLowerCase()
    .replace(" meses", "")} previos`;

  return (
    <section aria-labelledby="resumen-ejecutivo">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1
            id="resumen-ejecutivo"
            className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]"
          >
            Resumen ejecutivo
          </h1>
          <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
            {formatInt(historico.totalRevisiones)} revisiones ·{" "}
            {formatInt(historico.leadsTotal)} contactos ·{" "}
            {formatInt(historico.convertidos)} convertidos
          </p>
        </div>

        {/* Mismo control que el desglose de gastos: presets, no rango libre. */}
        <div className="flex shrink-0 gap-1" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onPeriodo(p.key)}
              aria-pressed={periodoKey === p.key}
              className={cn(
                "min-h-9 rounded-lg px-3 text-[12.5px] font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
                periodoKey === p.key
                  ? "bg-[var(--bi-surface-2)] text-[var(--bi-ink)]"
                  : "text-[var(--bi-ink-3)] hover:text-[var(--bi-ink-2)]",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* ================= bloque 1: lo que sí se mueve ================= */}
      {/* El rótulo nombra el CONTENIDO y el detalle nombra el ALCANCE. Al revés
          —las dos filas rotuladas por su rango— quedaban «Todo el histórico» y
          «Histórico completo» una encima de la otra, que se leen igual. */}
      <Rotulo
        texto="El negocio"
        detalle={
          hayPeriodo
            ? `Últimos ${etiquetaPeriodo.toLowerCase()}`
            : "Todo el histórico"
        }
      />
      {/**
       * **Un titular y tres de apoyo, no cuatro iguales — A135.**
       *
       * La portada tenía doce tarjetas del mismo tamaño en tres filas de cuatro.
       * Cuando todo pesa igual no hay mensaje, y para alguien que nunca vio un
       * tablero esa es la barrera: no es que no entienda un número, es que no
       * sabe **cuál de los doce** mirar.
       *
       * La utilidad es la respuesta a «¿cómo vamos?», así que va sola y grande.
       * Ingresos, gastos y revisiones la explican y van debajo, normales.
       */}
      <div className="grid gap-3 lg:grid-cols-[1.15fr_2fr]">
        <BiKpiCard
          index={0}
          label="Utilidad"
          tone="utilidad"
          destacada
          value={formatCompactCRC(periodo.utilidadCRC)}
          exact={formatCRC(periodo.utilidadCRC)}
          hint={`${formatPct(periodo.marginPct)} de margen`}
          delta={
            anterior
              ? variacion(periodo.utilidadCRC, anterior.utilidadCRC, contraPeriodo)
              : null
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <BiKpiCard
            index={1}
            label="Ingresos"
            tone="income"
            value={formatCompactCRC(periodo.ingresosFinancierosCRC)}
            exact={formatCRC(periodo.ingresosFinancierosCRC)}
            delta={
              anterior
                ? variacion(
                    periodo.ingresosFinancierosCRC,
                    anterior.ingresosFinancierosCRC,
                    contraPeriodo,
                  )
                : null
            }
          />
          <BiKpiCard
            index={2}
            label="Gastos"
            tone="expense"
            value={formatCompactCRC(periodo.gastosCRC)}
            exact={formatCRC(periodo.gastosCRC)}
            delta={
              anterior
                ? variacion(periodo.gastosCRC, anterior.gastosCRC, contraPeriodo)
                : null
            }
          />
          <BiKpiCard
            index={3}
            label="Revisiones"
            tone="neutral"
            value={formatInt(periodo.totalRevisiones)}
            hint={
              periodo.placeholderRows > 0
                ? `${formatInt(periodo.placeholderRows)} sin cobro`
                : "todas con cobro"
            }
            delta={
              anterior
                ? variacion(
                    periodo.totalRevisiones,
                    anterior.totalRevisiones,
                    contraPeriodo,
                  )
                : null
            }
          />
        </div>
      </div>

      {/* ================= bloque 2: lo que NO se mueve ================= */}
      <Rotulo
        texto="Contactos y conversión"
        detalle={
          hayFiltro
            ? "Sin recorte de periodo — abajo se explica qué respeta cada una"
            : "Sobre todo el histórico, sin recorte de periodo"
        }
      />
      {/**
       * **«Revisiones totales» solo cuando NO es la misma tarjeta de arriba — A135.**
       *
       * Sin periodo ni filtros, esta cifra y la «Revisiones» del bloque de
       * arriba son **el mismo número**, y estaban a dos tarjetas de distancia.
       * Repetir un número no lo confirma: hace dudar de si son dos cosas
       * distintas que casualmente coinciden.
       *
       * Con un filtro puesto sí son distintas —aquella se recorta y esta no— y
       * ahí la tarjeta vuelve, que es justo cuando aporta.
       */}
      <div
        className={cn(
          "grid grid-cols-2 gap-3",
          hayFiltro ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {hayFiltro ? (
          <BiKpiCard
            index={0}
            label="Revisiones totales"
            tone="neutral"
            value={formatInt(historico.totalRevisiones)}
            hint={
              historico.placeholderRows > 0
                ? `${formatInt(historico.totalRevisionesSinPlaceholder)} con cobro real`
                : "todas con cobro real"
            }
          />
        ) : null}
        <BiKpiCard
          index={1}
          label="Contactos"
          tone="neutral"
          value={formatInt(historico.leadsTotal)}
          hint={`${formatInt(historico.leadsWithPhone)} con teléfono usable`}
        />
        <BiKpiCard
          index={2}
          label="Convertidos"
          tone="income"
          value={formatInt(historico.convertidos)}
          hint="ya compraron"
        />
        <BiKpiCard
          index={3}
          label="Conversión"
          tone="utilidad"
          value={formatPct(historico.conversionPct)}
          // Pista corta: la tarjeta trunca lo que no cabe, y en 4 columnas cabe
          // poco. El detalle largo vive en el tablero de Leads.
          hint={`${formatPct(historico.conversionPctOfPhoned)} con teléfono`}
        />
      </div>

      {hayFiltro ? (
        <p className="mt-3 rounded-xl border border-[var(--bi-ring)] bg-[var(--bi-surface)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--bi-ink-3)]">
          <span className="font-semibold text-[var(--bi-ink-2)]">
            Qué respeta cada una de estas cuatro:
          </span>{" "}
          <b className="text-[var(--bi-ink-2)]">Revisiones totales</b> sí hace
          caso a los filtros de arriba, pero nunca al periodo — para eso está la
          tarjeta de «El negocio». Las otras tres —contactos, convertidos y
          conversión— <b className="text-[var(--bi-ink-2)]">no cambian con nada</b>:
          los contactos vienen de Airtable y no traen marca, provincia ni canal,
          así que no hay por dónde filtrarlos. Y recortarlos por periodo sería
          peor que no hacerlo: un contacto puede llegar en marzo y comprar en
          agosto, así que el corte dejaría compras sin su contacto —y contactos
          sin su compra— en los dos bordes, y el porcentaje saldría inflado o
          hundido según dónde caiga.
        </p>
      ) : null}

      {/* ================= tendencia + mezcla ================= */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <BiCard
          title="Cómo viene el año"
          subtitle={
            meses.length > 0
              ? `${meses.length} ${meses.length === 1 ? "mes" : "meses"} · ingresos contra gastos`
              : "Sin movimientos en el periodo"
          }
        >
          {meses.length > 0 ? (
            <BiMonthlyBars months={meses} />
          ) : (
            <p className="text-[13px] text-[var(--bi-ink-3)]">
              No hay movimientos registrados en el periodo elegido.
            </p>
          )}
        </BiCard>

        <BiCard
          title="De dónde vienen los clientes"
          subtitle="Reparto de las REVISIONES — no cuadra con los ingresos de arriba"
        >
          <MezclaCanales canales={canales} />
        </BiCard>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Rótulo de alcance. Existe para que la diferencia entre «del periodo» e
 * «histórico» sea **estructural y no una nota al pie**: dos filas de tarjetas
 * idénticas sin este renglón se leen como una sola tanda de ocho.
 */
function Rotulo({ texto, detalle }: { texto: string; detalle: string }) {
  return (
    <div className="mb-2 mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 first:mt-0">
      <h2 className="bi-num text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bi-ink-2)]">
        {texto}
      </h2>
      <p className="text-[12px] text-[var(--bi-ink-3)]">{detalle}</p>
    </div>
  );
}

/**
 * Mezcla de canales: barra apilada + lista.
 *
 * El reparto se hace por **revisiones** y no por ingresos. Es a propósito: la
 * pregunta de esta tarjeta es «¿de dónde viene la gente?», y con ingresos un
 * solo cliente caro correría la mezcla entera. El ticket promedio queda en la
 * lista para quien quiera la otra lectura.
 */
function MezclaCanales({ canales }: { canales: ChannelMixRow[] }) {
  // El backend los ordena por INGRESOS (`channels.ts:216`) y acá el reparto es
  // por revisiones: sin reordenar, la barra apilada saldría con los segmentos
  // desordenados —uno gordo, uno flaco, uno gordo— y se leería como un error de
  // dibujo. Se reordena en la vista, que es donde importa el orden.
  const visibles = canales
    .filter((c) => c.rows > 0)
    .sort((a, b) => b.rows - a.rows);
  if (visibles.length === 0) {
    return (
      <p className="text-[13px] text-[var(--bi-ink-3)]">
        No hay revisiones en el periodo elegido.
      </p>
    );
  }

  const total = visibles.reduce((s, c) => s + c.rows, 0);

  return (
    <div>
      {/* barra apilada: el reparto de un vistazo */}
      <div
        aria-hidden
        className="flex h-[10px] gap-[2px] overflow-hidden rounded-full"
      >
        {visibles.map((c, i) => (
          <span
            key={c.canal}
            className="bi-grow-x h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(c.rows / total) * 100}%`,
              background: colorCanal(i),
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {visibles.map((c, i) => (
          <li key={c.canal} className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-baseline gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 translate-y-[-1px] rounded-[3px]"
                style={{ background: colorCanal(i) }}
              />
              <span className="truncate text-[13.5px] text-[var(--bi-ink)]">
                {c.canal}
              </span>
              {c.mesesSinRevision >= 2 ? (
                <span className="shrink-0 text-[11px] text-[var(--bi-warn)]">
                  {c.mesesSinRevision} meses sin una
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-right">
              <span className="bi-num block text-[13px] tabular-nums text-[var(--bi-ink)]">
                {formatPct(c.pctRows)}
              </span>
              <span className="bi-num block text-[11px] tabular-nums text-[var(--bi-ink-3)]">
                {formatInt(c.rows)} · {formatCompactCRC(c.ticketPromedioCRC)} c/u
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Paleta de la mezcla. El color va **por posición** en la lista ya ordenada, no
 * por nombre de canal: así el canal más grande se ve siempre del mismo color y
 * la tarjeta no se repinta entera el día que aparezca un canal nuevo.
 */
const CANAL_COLORES = [
  "var(--bi-income)",
  "var(--bi-good)",
  "var(--bi-warn)",
  "var(--bi-expense)",
  "var(--bi-ink-2)",
  "var(--bi-ink-3)",
] as const;

function colorCanal(i: number): string {
  return CANAL_COLORES[i % CANAL_COLORES.length];
}
