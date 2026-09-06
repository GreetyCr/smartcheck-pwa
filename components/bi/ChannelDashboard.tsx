"use client";

import { AlertTriangle, Megaphone } from "lucide-react";
import {
  formatCompactCRC,
  formatCRC,
  formatInt,
  formatMonthAbbr,
  formatPct,
} from "@/lib/bi-format";
import { BiCard } from "./BiCard";
import { CanalesPorMesChart } from "./CanalesPorMesChart";
import { BiKpiCard } from "./BiKpiCard";

/* -------------------------------------------------------------------------- */
/* Tipos — espejo del retorno de `bi/public:channelRevenue`                    */
/* -------------------------------------------------------------------------- */

export type CanalRow = {
  canal: string;
  rows: number;
  rowsConMonto: number;
  ingresosCRC: number;
  pctIngresos: number;
  pctRows: number;
  ticketPromedioCRC: number;
  ultimaRevisionISO: string | null;
  mesesSinRevision: number;
};

export type CanalMes = {
  ym: string;
  enCurso: boolean;
  rows: number;
  ingresosCRC: number;
  publicidadCRC: number;
  canales: Array<{ canal: string; rows: number; ingresosCRC: number }>;
};

export type ChannelRevenue = {
  totalRows: number;
  totalRowsConMonto: number;
  totalIngresosCRC: number;
  ticketPromedioCRC: number;
  canales: CanalRow[];
  porMes: CanalMes[];
  publicidad: {
    totalCRC: number;
    canalAtribuido: string;
    mesesConPauta: number;
    mesesSinPautaRegistrada: number;
    rowsAtribuidas: number;
    ingresosAtribuidosCRC: number;
    rowsCanalTotal: number;
    costoPorRevisionCRC: number;
    retornoPorColon: number;
  };
};

/**
 * Color por canal. Fijo y nombrado, no derivado del orden: si el orden cambia
 * —y cambia, porque se ordena por ingreso— un canal no puede cambiar de color
 * entre dos cargas de la misma pantalla.
 */
const COLOR_CANAL: Record<string, string> = {
  Mercadeo: "var(--bi-income)",
  Recompra: "var(--bi-good)",
  Referido: "#7c9fd6",
  TikTok: "#c084fc",
  Buscador: "var(--bi-warn)",
  Otro: "var(--bi-ink-3)",
};
const COLOR_SIN_CANAL = "var(--bi-ink-3)";

const colorDe = (canal: string) => COLOR_CANAL[canal] ?? COLOR_SIN_CANAL;

/** Cuántos meses de silencio bastan para llamarlo apagado. */
const MESES_PARA_APAGADO = 2;

/* -------------------------------------------------------------------------- */

/**
 * Tablero de **Ingresos por canal** (F3) — capa 100% presentacional.
 *
 * Tres cosas que esta pantalla dice y que ninguna otra dice:
 *
 * 1. **Cuánto vale cada canal y a qué ticket.** Dos canales pueden traer lo
 *    mismo con tickets muy distintos, y esa es la comparación que sirve para
 *    decidir dónde empujar.
 * 2. **Cuál se apagó.** Un canal que dejó de traer revisiones desaparece de la
 *    conversación sin que nadie lo note; acá se rotula con cuántos meses lleva
 *    callado, para que la ausencia sea un dato y no un vacío.
 * 3. **Qué devuelve la pauta.** Es la única plata de este tablero que Esteban
 *    controla directamente mes a mes.
 *
 * Y dos cosas que **no** dice, declaradas en pantalla en vez de omitidas:
 * los ingresos de acá salen de las revisiones y **no cuadran con el P&L**
 * (A16), y **no hay embudo de leads por canal** porque en Airtable el origen
 * está vacío en las 9.290 fichas (al 6-set-2026, y en todas las anteriores).
 */
export function ChannelDashboard({ data }: { data: ChannelRevenue }) {
  const { canales, porMes, publicidad } = data;

  const apagados = canales.filter(
    (c) => c.mesesSinRevision >= MESES_PARA_APAGADO && c.rows > 0,
  );
  const lider = canales[0];
  const maxIngresoCanal = Math.max(1, ...canales.map((c) => c.ingresosCRC));

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* Indicadores                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BiKpiCard
          index={0}
          label="Revisiones"
          value={formatInt(data.totalRows)}
          hint={
            lider
              ? `${lider.canal} trae ${formatPct(lider.pctRows)} de todas`
              : undefined
          }
          tone="neutral"
        />
        <BiKpiCard
          index={1}
          label="Ingresos de revisiones"
          value={formatCompactCRC(data.totalIngresosCRC)}
          exact={formatCRC(data.totalIngresosCRC)}
          hint="Solo lo cobrado en revisiones — ver la nota"
          tone="income"
        />
        <BiKpiCard
          index={2}
          label="Ticket promedio"
          value={formatCRC(data.ticketPromedioCRC)}
          hint={`Sobre ${formatInt(data.totalRowsConMonto)} revisiones con cobro anotado`}
          tone="neutral"
        />
        {/**
         * **El KPI arrastra su base — A149.**
         *
         * Medido contra producción el 6-set: el KPI decía «₡9.402 de pauta por
         * revisión de Mercadeo» y la lista de más abajo mostraba 17 meses que
         * suman **663** revisiones de Mercadeo. ₡5.509.328 ÷ 663 = **₡8.310**.
         * El denominador real del KPI es **586**, porque deja fuera los 3 meses
         * con revisiones y sin pauta anotada (77 revisiones). **Dos números con
         * el mismo rótulo en la misma pantalla, 13% aparte.**
         *
         * Las tres tarjetas de la izquierda hablan de **todos los canales**;
         * ésta habla de **un canal en un subconjunto de meses**. El número está
         * bien —incluir los meses sin gasto anotado abarataría el costo solo
         * porque falta el dato— y lo que faltaba era decir sobre qué se calcula,
         * donde se lee (B44 · A126 · A133 · A144 · A148).
         */}
        <BiKpiCard
          index={3}
          label="Retorno de la pauta"
          value={
            publicidad.retornoPorColon > 0
              ? `${publicidad.retornoPorColon.toLocaleString("es-CR")}×`
              : "—"
          }
          hint={`₡${formatInt(publicidad.costoPorRevisionCRC)} por revisión · sobre ${formatInt(publicidad.rowsAtribuidas)} de ${publicidad.canalAtribuido} en los ${publicidad.mesesConPauta} meses con pauta anotada`}
          tone="utilidad"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Canal por canal                                                    */}
      {/* ------------------------------------------------------------------ */}
      <BiCard
        title="Qué trae cada canal"
        subtitle="Ordenado por ingreso. El ticket compara canales; el ingreso los pesa."
      >
        {canales.length === 0 ? (
          <p className="text-xs text-[var(--bi-ink-3)]">
            No hay revisiones en el periodo.
          </p>
        ) : (
          <ul className="space-y-4">
            {canales.map((c, i) => {
              const apagado = c.mesesSinRevision >= MESES_PARA_APAGADO;
              return (
                <li key={c.canal}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 translate-y-[1px] rounded-[3px]"
                        style={{ background: colorDe(c.canal) }}
                      />
                      <span className="truncate text-[14px] font-medium text-[var(--bi-ink)]">
                        {c.canal}
                      </span>
                      {apagado ? (
                        <span className="shrink-0 rounded-full border border-[var(--bi-warn)]/40 bg-[var(--bi-warn)]/10 px-2 py-[1px] text-[10.5px] font-semibold uppercase tracking-wide text-[var(--bi-warn)]">
                          {c.mesesSinRevision} meses sin revisiones
                        </span>
                      ) : null}
                    </span>
                    <span className="bi-num shrink-0 tabular-nums text-[14px] text-[var(--bi-ink)]">
                      {formatCRC(c.ingresosCRC)}
                    </span>
                  </div>

                  <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
                    <div
                      className="bi-grow-x h-full rounded-full"
                      style={{
                        width: `${Math.max((c.ingresosCRC / maxIngresoCanal) * 100, 2)}%`,
                        background: colorDe(c.canal),
                        animationDelay: `${i * 50}ms`,
                      }}
                    />
                  </div>

                  <div className="bi-num mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] tabular-nums text-[var(--bi-ink-3)]">
                    <span>{formatPct(c.pctIngresos)} del ingreso</span>
                    <span>{formatInt(c.rows)} revisiones</span>
                    <span>ticket {formatCRC(c.ticketPromedioCRC)}</span>
                    {c.rowsConMonto !== c.rows ? (
                      <span className="text-[var(--bi-warn)]">
                        {formatInt(c.rows - c.rowsConMonto)} sin cobro anotado
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {apagados.length > 0 ? (
          <p className="mt-4 flex gap-2 border-t border-[var(--bi-ring)] pt-3 text-[12.5px] leading-relaxed text-[var(--bi-ink-2)]">
            <AlertTriangle
              className="mt-[2px] size-4 shrink-0 text-[var(--bi-warn)]"
              aria-hidden
            />
            <span>
              <b className="text-[var(--bi-ink)]">
                {apagados.map((c) => c.canal).join(" y ")}
              </b>{" "}
              {apagados.length === 1 ? "no trae" : "no traen"} una revisión desde
              hace meses. Sigue{apagados.length === 1 ? "" : "n"} contando en el
              acumulado, así que en el total {apagados.length === 1 ? "se ve" : "se ven"}{" "}
              más vivo{apagados.length === 1 ? "" : "s"} de lo que{" "}
              {apagados.length === 1 ? "está" : "están"}.
            </span>
          </p>
        ) : null}
      </BiCard>

      {/* ------------------------------------------------------------------ */}
      {/* Mes a mes, canal por canal                                         */}
      {/* ------------------------------------------------------------------ */}
      <BiCard
        title="Mes a mes"
        subtitle="La altura es cuántas revisiones hubo ese mes; el color, de qué canal salieron"
      >
        <CanalesPorMesChart
          canales={canales}
          porMes={porMes}
          colorDe={colorDe}
        />
        <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-xs leading-relaxed text-[var(--bi-ink-3)]">
          Un canal chico se ve como una franja delgada, así que para saber si
          alguno se apagó mirá la tabla de arriba: ahí cada canal dice cuántos
          meses lleva sin traer una revisión.
        </p>
      </BiCard>

      {/* ------------------------------------------------------------------ */}
      {/* La pauta                                                           */}
      {/* ------------------------------------------------------------------ */}
      <BiCard
        title="Lo que devuelve la pauta"
        subtitle={`Toda la publicidad se le carga a ${publicidad.canalAtribuido} — en la hoja es una sola bolsa, sin separar por plataforma.`}
      >
        <PautaMensual porMes={porMes} publicidad={publicidad} />
      </BiCard>

      {/* ------------------------------------------------------------------ */}
      {/* Las dos advertencias                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-[var(--bi-ring)] bg-[var(--bi-surface)] p-4 text-[12.5px] leading-relaxed text-[var(--bi-ink-3)] sm:p-5">
        <p>
          <b className="text-[var(--bi-ink-2)]">
            Estos ingresos no son los del tablero de Finanzas.
          </b>{" "}
          Acá se suma lo cobrado en cada revisión; allá se suma el P&amp;L
          completo, que incluye ingresos que no son revisiones. Los dos números
          son correctos y no tienen por qué coincidir.
        </p>
        <p className="mt-2">
          <b className="text-[var(--bi-ink-2)]">
            No hay desglose de leads por canal.
          </b>{" "}
          El canal solo viene en las revisiones: en Airtable el campo de origen
          está vacío en las 9.096 fichas, así que no se puede saber de qué canal
          venía un lead que no se convirtió.
        </p>
        <p className="mt-2">
          <b className="text-[var(--bi-ink-2)]">
            El costo por revisión está calculado por lo alto.
          </b>{" "}
          Si TikTok o Buscador también llevan pauta, parte de ese gasto no es de{" "}
          {publicidad.canalAtribuido} y su costo real es menor.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pauta: gasto y costo por revisión, mes a mes                               */
/* -------------------------------------------------------------------------- */

function PautaMensual({
  porMes,
  publicidad,
}: {
  porMes: CanalMes[];
  publicidad: ChannelRevenue["publicidad"];
}) {
  const filas = porMes
    .map((m) => {
      const rev =
        m.canales.find((c) => c.canal === publicidad.canalAtribuido)?.rows ?? 0;
      return {
        ym: m.ym,
        enCurso: m.enCurso,
        pauta: m.publicidadCRC,
        rev,
        // Hacen falta las DOS cosas para que el cociente signifique algo. Sin
        // pauta anotada el costo no es ₡0 —que se leería como «salieron
        // gratis»—, es que no se sabe: va como «—».
        costo:
          rev > 0 && m.publicidadCRC > 0
            ? Math.round(m.publicidadCRC / rev)
            : null,
      };
    })
    .filter((f) => f.pauta > 0 || f.rev > 0);

  /**
   * **Los meses que el KPI no cuenta, y por qué no son todos lo mismo — A149.**
   *
   * Un mes con revisiones y sin pauta anotada queda fuera de la cuenta, y hasta
   * hoy se declaraba solo como un conteo («hay 3 meses…»): el lector veía sus
   * revisiones en la lista y no tenía forma de saber cuáles eran las que
   * faltaban. Ahora se marcan **en la fila**, que es donde se leen.
   *
   * Y se separan dos cosas que el backend cuenta juntas: **«no se anotó el
   * gasto»** y **«el mes todavía no cerró»**. El segundo no es un dato que
   * falte, es un mes en curso — mezclarlos sugiere un descuido donde no lo hay.
   */
  const fueraDelKpi = filas.filter((f) => f.pauta === 0 && f.rev > 0);
  const sinPautaAnotada = fueraDelKpi.filter((f) => !f.enCurso);
  const revFuera = fueraDelKpi.reduce((s, f) => s + f.rev, 0);

  if (filas.length === 0) {
    return (
      <p className="text-xs text-[var(--bi-ink-3)]">
        No hay pauta ni revisiones en el periodo.
      </p>
    );
  }

  const maxCosto = Math.max(1, ...filas.map((f) => f.costo ?? 0));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[12.5px] text-[var(--bi-ink-2)]">
        <span className="flex items-center gap-2">
          <Megaphone className="size-4 text-[var(--bi-expense)]" aria-hidden />
          Pauta: <b className="text-[var(--bi-ink)]">{formatCRC(publicidad.totalCRC)}</b>
        </span>
        <span>
          {publicidad.canalAtribuido} <span className="text-[var(--bi-ink-3)]">en esos meses</span>:{" "}
          <b className="text-[var(--bi-ink)]">{formatInt(publicidad.rowsAtribuidas)}</b>{" "}
          revisiones · {formatCRC(publicidad.ingresosAtribuidosCRC)}
        </span>
      </div>

      {fueraDelKpi.length > 0 ? (
        <p className="mb-4 rounded-xl border border-[var(--bi-warn)]/30 bg-[var(--bi-warn)]/[0.07] px-3 py-2 text-[12px] leading-relaxed text-[var(--bi-ink-2)]">
          {publicidad.canalAtribuido} tiene{" "}
          <b className="text-[var(--bi-ink)]">{formatInt(publicidad.rowsCanalTotal)}</b>{" "}
          revisiones en todo el periodo, pero la cuenta de arriba usa{" "}
          <b className="text-[var(--bi-ink)]">{formatInt(publicidad.rowsAtribuidas)}</b>:
          quedan fuera las{" "}
          <b className="text-[var(--bi-ink)]">{formatInt(revFuera)}</b> de{" "}
          {fueraDelKpi.length === 1 ? "un mes" : `${fueraDelKpi.length} meses`}{" "}
          sin pauta que dividir, marcad{fueraDelKpi.length === 1 ? "o" : "os"} abajo.{" "}
          {/* «En 2 de ellos» sobra cuando los dos son 2: solo se cualifica
              cuando de verdad hay mezcla con el mes en curso. */}
          {sinPautaAnotada.length > 0 ? (
            <>
              {sinPautaAnotada.length < fueraDelKpi.length
                ? `En ${sinPautaAnotada.length} de ellos `
                : ""}
              <b className="text-[var(--bi-ink)]">
                {sinPautaAnotada.length < fueraDelKpi.length
                  ? "falta"
                  : "Falta"}{" "}
                anotar el gasto
              </b>{" "}
              en la hoja; si entrara, el costo por revisión saldría más barato de
              lo real solo porque falta el dato.
            </>
          ) : null}
          {fueraDelKpi.length > sinPautaAnotada.length
            ? " El mes en curso no cuenta porque todavía no cerró."
            : null}
        </p>
      ) : null}

      <ul className="space-y-2">
        {filas.map((f) => (
          <li key={f.ym} className="flex items-center gap-3">
            <span className="bi-num w-[52px] shrink-0 text-[11px] uppercase tabular-nums text-[var(--bi-ink-3)]">
              {formatMonthAbbr(f.ym)}
            </span>
            <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
              <span
                className="bi-grow-x block h-full rounded-full"
                style={{
                  width: `${Math.max(((f.costo ?? 0) / maxCosto) * 100, f.costo ? 2 : 0)}%`,
                  background: "var(--bi-expense)",
                  opacity: f.enCurso ? 0.55 : undefined,
                }}
              />
            </span>
            <span
              className="bi-num w-[78px] shrink-0 text-right text-[12px] tabular-nums text-[var(--bi-ink)]"
              title={
                f.costo === null && f.rev > 0
                  ? "Sin pauta que dividir: este mes no entra en la cuenta de arriba"
                  : undefined
              }
            >
              {f.costo === null ? "—" : formatCRC(f.costo)}
            </span>
            <span className="bi-num hidden w-[168px] shrink-0 text-right text-[11px] tabular-nums text-[var(--bi-ink-3)] sm:block">
              {formatCRC(f.pauta)} · {formatInt(f.rev)} rev.
              {f.costo === null && f.rev > 0 ? (
                <span className="ml-1.5 text-[var(--bi-warn)]">fuera</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-[var(--bi-ring)] pt-3 text-[11.5px] leading-relaxed text-[var(--bi-ink-3)]">
        La barra es el <b className="text-[var(--bi-ink-2)]">costo de pauta por
        revisión</b> del mes: más corta es mejor. El mes en curso va traslúcido
        porque su gasto todavía no está completo y hace ver el costo más bajo de
        lo que va a quedar.{" "}
        {fueraDelKpi.length > 0 ? (
          <>
            Los marcados <b className="text-[var(--bi-warn)]">fuera</b> tienen
            revisiones y no tienen pauta, así que no hay costo que calcular y no
            entran en la cuenta de arriba.
          </>
        ) : null}
      </p>
    </div>
  );
}
