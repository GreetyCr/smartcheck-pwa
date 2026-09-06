"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info, MinusCircle } from "lucide-react";
import {
  formatDateCR,
  formatInt,
  formatMonthLong,
  formatPct,
} from "@/lib/bi-format";
import { cn } from "@/lib/utils";
import { BiCard } from "./BiCard";
import { ConversionPorMesChart } from "./ConversionPorMesChart";
import { BiCountBars } from "./BiCountBars";
import { BiKpiCard } from "./BiKpiCard";
import { ConvertedLeadsCard } from "./ConvertedLeadsCard";
import { LeadsPorRevisarCard } from "./LeadsPorRevisarCard";
import type {
  ConversionFunnel,
  ConvertedLead,
  LeadsPorRevisar,
  LeadsStats,
  MatchesStats,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Vocabulario                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Los tres métodos de emparejamiento, en orden de confianza y con lo único que
 * de verdad importa al leerlos: **si cuentan o no en la conversión titular**.
 * El orden es fijo y no depende del que devuelva el backend: es una escala
 * (alta → baja), no un ranking por volumen.
 */
const METHODS = [
  {
    key: "phone_exact",
    label: "Teléfono exacto",
    band: "Alta",
    counts: true,
    detail: "Un solo lead y una sola revisión con ese número.",
  },
  {
    key: "phone_vehicle_window",
    label: "Teléfono + vehículo y fechas",
    band: "Media",
    counts: true,
    detail: "El número se repite; se desempata por marca del carro y fechas.",
  },
  {
    key: "name_vehicle_window",
    label: "Nombre completo + vehículo",
    band: "Baja",
    counts: false,
    detail: "Sin teléfono en común. Puede haber homónimos.",
  },
] as const;

/** Destino del emparejamiento: dónde vive la revisión con la que se cruzó. */
const TARGET_LABELS: Record<string, string> = {
  legacy: "Revisión del histórico (CRM viejo)",
  era_app: "Revisión hecha en la app",
};

const ISSUE_LABELS: Record<string, string> = {
  lead_dup: "Leads duplicados",
  anomalous_phone: "Teléfono con formato raro",
  lead_no_key: "Lead sin llave (ni teléfono ni ManyChat)",
};

/**
 * Avisos que son **ruido esperado por diseño**, no problemas.
 *
 * `lead_dup` sale de A26: los duplicados se marcan, nunca se fusionan, porque
 * los bots de Hans siguen usando Airtable como estado en vivo. Mostrar sus
 * ~1.700 avisos junto a lo accionable enseñaría a ignorar el tablero entero
 * desde el primer día, así que van en su propio bloque y no suman al contador.
 */
const EXPECTED_ISSUES = new Set(["lead_dup"]);

const ISSUE_NOTES: Record<string, string> = {
  lead_dup:
    "Un mismo cliente que escribió más de una vez. Se marcan y se conservan tal cual; fusionarlos rompería el estado que los bots llevan en Airtable.",
  anomalous_phone:
    "Números que no calzan con un teléfono de 8 dígitos. No se pueden cruzar contra revisiones.",
  lead_no_key:
    "Sin teléfono ni ManyChat no hay forma de saber si esa persona volvió.",
};

const pctOf = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

/* -------------------------------------------------------------------------- */

/**
 * Tablero de Leads & conversión — capa 100% presentacional (recibe datos).
 * Mismo lenguaje visual que Finanzas: superficie grafito, acento cian para la
 * serie principal, tinta neutra para lo que no es titular.
 *
 * La regla que ordena todo el tablero: **la conversión son los emparejamientos
 * de banda alta y media con ingreso válido**, y los empates débiles por nombre
 * viven aparte, rotulados como estimación. Cada bloque dice sobre qué universo
 * habla, porque acá conviven dos —los titulares y el total de emparejamientos
 * con ingreso válido— y las dos cifras se mueven cada lunes con el sync.
 */
export function LeadsDashboard({
  funnel,
  matches,
  leads,
  porRevisar,
  converted,
}: {
  funnel: ConversionFunnel;
  matches: MatchesStats;
  leads: LeadsStats;
  porRevisar: LeadsPorRevisar;
  converted: ConvertedLead[];
}) {
  const phonePct = pctOf(leads.phone8Present, leads.total);

  /**
   * **«De cada 100» en vez de un embudo de tres barras — A138.**
   *
   * Era un embudo: 9.290 (100%), 9.218 (99,2%), 220 (2,37%). Dos barras llenas
   * y una astilla invisible. Y el paso del medio **no es un paso del negocio**:
   * que un contacto traiga teléfono es un hecho de la calidad del dato, no algo
   * que la persona hizo. Dibujarlo como escalón sugiere que ahí se pierde
   * gente, y no se pierde nadie.
   *
   * Cuando la historia es **un solo número**, la forma correcta es decirlo, no
   * graficarlo. Y «2 de cada 100» se entiende sin saber leer un porcentaje, que
   * es exactamente el lector de este panel.
   *
   * Por debajo del 1% se pasa a «de cada 1.000»: con una tasa de 0,32% —la de
   * diciembre de 2025— «0 de cada 100» diría que nadie compró, y sí compraron.
   */
  const deCadaCuantos = useMemo(() => {
    const pct = funnel.convertedRatePct;
    const base = pct >= 1 ? 100 : 1000;
    return { base, cuantos: Math.round((pct / 100) * base) };
  }, [funnel.convertedRatePct]);

  const methodRows = useMemo(() => {
    const byMethod = new Map(funnel.byMethod.map((m) => [m.method, m.rows]));
    const known = METHODS.map((m) => ({ ...m, rows: byMethod.get(m.key) ?? 0 }));
    // Un método nuevo en el backend no puede desaparecer del tablero en
    // silencio: se muestra al final, y como no sabemos su banda, no cuenta.
    const extra = funnel.byMethod
      .filter((m) => !METHODS.some((k) => k.key === m.method))
      .map((m) => ({
        key: m.method,
        label: m.method,
        band: "—",
        counts: false,
        detail: "Método nuevo: revisar en el backend antes de interpretarlo.",
        rows: m.rows,
      }));
    return [...known, ...extra];
  }, [funnel.byMethod]);

  const targetRows = useMemo(
    () =>
      funnel.byTarget
        .map((t) => ({
          key: t.target,
          label: TARGET_LABELS[t.target] ?? t.target,
          value: t.rows,
          meta: formatPct(pctOf(t.rows, funnel.leadsMatched)),
        }))
        .sort((a, b) => b.value - a.value),
    [funnel.byTarget, funnel.leadsMatched],
  );

  const coverageRows = useMemo(
    () => [
      {
        key: "phone",
        label: "Teléfono",
        value: leads.phone8Present,
        meta: formatPct(phonePct),
      },
      {
        key: "name",
        label: "Nombre",
        value: leads.namePresent,
        meta: formatPct(pctOf(leads.namePresent, leads.total)),
      },
      {
        key: "manychat",
        label: "ManyChat",
        value: leads.manychatPresent,
        meta: formatPct(pctOf(leads.manychatPresent, leads.total)),
      },
    ],
    [leads, phonePct],
  );

  const { expectedIssues, actionableIssues, actionableTotal } = useMemo(() => {
    const expected = leads.issuesByType.filter((i) =>
      EXPECTED_ISSUES.has(i.issueType),
    );
    const actionable = leads.issuesByType.filter(
      (i) => !EXPECTED_ISSUES.has(i.issueType),
    );
    return {
      expectedIssues: expected,
      actionableIssues: actionable,
      actionableTotal: actionable.reduce((s, i) => s + i.rows, 0),
    };
  }, [leads.issuesByType]);

  /**
   * Un mismo lead puede disparar los dos avisos accionables (un PSID no sirve
   * de teléfono Y deja al lead sin llave), así que 183 avisos no son 183
   * personas. Se dicen los dos números para que nadie los confunda.
   */
  const leadsPorRevisarDistintos = useMemo(() => {
    const ids = new Set<string>();
    for (const l of porRevisar.sinLlave) ids.add(l.airtableId);
    for (const l of porRevisar.telefonoRaro) ids.add(l.airtableId);
    return ids.size;
  }, [porRevisar]);

  /**
   * Leads sin canal. El backend agrupa los vacíos bajo la etiqueta `(vacío)`,
   * así que el número sale del dato y no de dar por hecho que están todos.
   */
  const channelMissing =
    leads.byChannel.find((c) => c.channel === "(vacío)")?.rows ?? 0;

  const rangeLabel =
    leads.minSourceCreatedAt > 0 && leads.maxSourceCreatedAt > 0
      ? `${formatDateCR(leads.minSourceCreatedAt)} – ${formatDateCR(leads.maxSourceCreatedAt)}`
      : "sin fechas de origen";

  /** Mes en curso en hora de Costa Rica: su cohorte todavía no cerró. */
  const mesActualCR = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Costa_Rica",
        year: "numeric",
        month: "2-digit",
      }).format(new Date()),
    [],
  );

  /**
   * Los extremos de la serie, para decir en palabras lo que muestra el gráfico.
   *
   * Se comparan **meses cerrados**: incluir el mes en curso haría anunciar una
   * caída cada día 1. Y se exige más de un mes cerrado, porque «de 6,2% a 6,2%»
   * no es una tendencia, es una barra.
   */
  const tendencia = useMemo(() => {
    const cerrados = funnel.porMes.filter((m) => m.yearMonth !== mesActualCR);
    if (cerrados.length < 2) return null;
    const a = cerrados[0];
    const b = cerrados[cerrados.length - 1];
    return {
      mesDesde: a.yearMonth,
      mesHasta: b.yearMonth,
      desde: formatPct(a.tasaPct, 2),
      hasta: formatPct(b.tasaPct, 2),
    };
  }, [funnel.porMes, mesActualCR]);

  return (
    /* El tema (`.bi-graphite`) lo aplica el contenedor —shell de /admin o la
       vista de revisión—; acá solo se maqueta el contenido. */
    <div>
      {/* ---------- encabezado ---------- */}
      <header className="mb-6">
        <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
          Leads &amp; conversión
        </h1>
        <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          {formatInt(funnel.leadsTotal)} leads · {rangeLabel}
        </p>
        {/* En el resto del tablero el periodo corta por la fecha de la REVISIÓN;
            acá corta por la fecha del CONTACTO. Es la lectura correcta para esta
            pregunta, y justo por eso hay que decirlo: un filtro que significa
            dos cosas distintas según la pestaña, callado, es peor que no
            tenerlo (A64). */}
        <p className="mt-2 text-[12px] text-[var(--bi-ink-3)]">
          {funnel.conPeriodo
            ? "El periodo corta por la fecha en que llegó el contacto, no por la de la revisión: son los leads que entraron en ese lapso y lo que pasó con ellos después."
            : "Sin periodo: todo el histórico. El filtro de arriba corta por la fecha en que llegó el contacto."}
          {funnel.leadsSinFecha > 0 ? (
            <>
              {" "}
              <span className="text-[var(--bi-ink-2)]">
                {formatInt(funnel.leadsSinFecha)}{" "}
                {funnel.leadsSinFecha === 1
                  ? "contacto no trae fecha de creación y no se puede ubicar"
                  : "contactos no traen fecha de creación y no se pueden ubicar"}{" "}
                en un periodo.
              </span>
            </>
          ) : null}
        </p>
      </header>

      {/* ---------- KPIs ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Las pistas van cortas a propósito: en móvil cada tarjeta mide media
            pantalla y `BiKpiCard` corta la pista con elipsis. Lo que no cabe acá
            se explica en la tarjeta que corresponde, nunca a medio truncar. */}
        <BiKpiCard
          index={0}
          label="Leads recibidos"
          tone="neutral"
          /* La base del titular sale del embudo, no de `leadsStats.total`: el
             embudo descarta los leads con borrado suave y `leadsStats` no. Hoy
             ambos dan lo mismo, pero el día que se retire uno, el denominador de
             la conversión y la cifra de portada tienen que seguir siendo el
             mismo número. La cobertura de abajo sí va sobre `leadsStats`, y lo
             dice en su subtítulo. */
          value={formatInt(funnel.leadsTotal)}
          hint="Desde WhatsApp"
        />
        <BiKpiCard
          index={1}
          label="Con teléfono"
          tone="neutral"
          value={formatPct(phonePct)}
          exact={`${formatInt(leads.phone8Present)} de ${formatInt(leads.total)}`}
          hint="Llave del cruce"
        />
        <BiKpiCard
          index={2}
          label="Convirtieron"
          tone="income"
          value={formatInt(funnel.converted)}
          hint="Revisión pagada"
        />
        <BiKpiCard
          index={3}
          label="Conversión"
          tone="income"
          value={formatPct(funnel.convertedRatePct, 2)}
          /* `exact` lleva la base del porcentaje por la misma razón por la que
             en Finanzas lleva el monto sin abreviar: un número solo no se puede
             verificar. 2,4% de nada no significa lo mismo que 2,4% de miles. */
          exact={`${formatInt(funnel.converted)} de ${formatInt(funnel.leadsTotal)} leads`}
          hint="Por teléfono"
        />
      </div>

      {/* ---------- la tendencia, arriba de todo lo demás ---------- */}
      <BiCard
        className="mt-4"
        title="Conversión mes a mes"
        subtitle="De los contactos que llegaron en cada mes, cuántos terminaron en una revisión pagada"
      >
        <ConversionPorMesChart meses={funnel.porMes} mesEnCurso={mesActualCR} />
        {tendencia ? (
          <p className="mt-3 border-t border-[var(--bi-ring)] pt-3 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
            De <strong className="text-[var(--bi-ink)]">{tendencia.desde}</strong>{" "}
            en {formatMonthLong(tendencia.mesDesde)} a{" "}
            <strong className="text-[var(--bi-ink)]">{tendencia.hasta}</strong> en{" "}
            {formatMonthLong(tendencia.mesHasta)}.{" "}
            <span className="text-[var(--bi-ink-3)]">
              El {formatPct(funnel.convertedRatePct, 2)} de arriba es el promedio
              de todo el periodo, y por eso se mueve tan poco: cada mes entra un
              millar de contactos nuevos al denominador.
            </span>
          </p>
        ) : null}
      </BiCard>

      {/* ---------- embudo + estimación aparte ---------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.9fr_1fr]">
        {/* `min-w-0` en cada hijo del grid: sin él, una tabla ancha no scrollea
            en su propia caja, estira la columna y saca scroll horizontal a toda
            la página en móvil. Es la misma razón por la que el shell de /admin
            lo lleva en su columna de contenido. */}
        <BiCard
          className="min-w-0"
          title="Del contacto al cliente"
          subtitle="Cuánta de la gente que escribe termina haciendo la revisión"
        >
          <p className="text-[20px] font-semibold leading-snug text-[var(--bi-ink)] sm:text-[24px]">
            De cada{" "}
            <span className="bi-num tabular-nums">
              {formatInt(deCadaCuantos.base)}
            </span>{" "}
            personas que escriben,{" "}
            <span className="bi-num tabular-nums text-[var(--bi-income)]">
              {formatInt(deCadaCuantos.cuantos)}
            </span>{" "}
            {deCadaCuantos.cuantos === 1 ? "hace" : "hacen"} la revisión.
          </p>
          <p className="bi-num mt-2 text-[13px] tabular-nums text-[var(--bi-ink-2)]">
            {formatInt(funnel.leadsTotal)} escribieron ·{" "}
            {formatInt(funnel.converted)} pagaron una revisión ·{" "}
            {formatPct(funnel.convertedRatePct, 2)}
          </p>
          <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-xs leading-relaxed text-[var(--bi-ink-3)]">
            El teléfono es lo que permite ligar a una persona con su revisión: de
            un contacto sin número no hay forma de saber si compró.{" "}
            <span className="bi-num tabular-nums text-[var(--bi-ink-2)]">
              {formatInt(funnel.leadsTotal - funnel.leadsWithPhone)}
            </span>{" "}
            de los {formatInt(funnel.leadsTotal)} están en ese caso —
            {formatPct(pctOf(funnel.leadsTotal - funnel.leadsWithPhone, funnel.leadsTotal))}
            —, así que si alguno hizo una revisión, no aparece acá.
          </p>
          {/* Se comparó «Convirtieron» contra el total de revisiones de Canales
              y no cuadraba. No tiene por qué: cuentan cosas distintas. Decirlo
              acá, donde está el número, en vez de esperar que alguien recuerde
              la nota del encabezado. */}
          <p className="mt-2 text-xs leading-relaxed text-[var(--bi-ink-3)]">
            <strong>Esto no es la cantidad de revisiones del periodo.</strong> Es
            cuántos de los <em>contactos que llegaron</em> en él ya son clientes.
            Las revisiones del periodo están en Inspecciones y en Canales, y son
            más: hay revisiones que <strong>no tienen lead</strong> con el cual
            emparejarse —el CRM viejo casi nunca trae teléfono— y otras cuyo lead
            <strong> llegó antes</strong>, así que su conversión no cuenta acá
            aunque su revisión sí cuente allá.
          </p>
          {funnel.recompras > 0 ? (
            /* No es una salvedad menor: son personas que el emparejamiento
               encuentra de verdad, pero que ya eran clientes. Contarlas le
               atribuiría al bot un cliente que ya estaba. */
            <p className="mt-2 text-xs text-[var(--bi-ink-3)]">
              Aparte:{" "}
              <span className="bi-num tabular-nums text-[var(--bi-ink-2)]">
                {formatInt(funnel.recompras)}
              </span>{" "}
              {funnel.recompras === 1 ? "contacto" : "contactos"} de este periodo
              {funnel.recompras === 1 ? " cruzó" : " cruzaron"} con una revisión{" "}
              <strong>anterior</strong> a su primer mensaje: ya eran clientes y
              volvieron a escribir. Son recompra, no conversión, y por eso no
              suman arriba.
            </p>
          ) : null}
        </BiCard>

        {/* Bloque aparte y en tinta neutra: es la estimación, no la cifra. */}
        <BiCard
          className="min-w-0"
          title="Posibles adicionales por nombre"
          subtitle="Estimación · no se suma a la conversión"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--bi-ring)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--bi-ink-3)]">
            <Info className="size-3" aria-hidden />
            Estimación
          </span>
          <p className="mt-3 text-[30px] font-semibold leading-none text-[var(--bi-ink-2)]">
            {formatInt(funnel.possibleAdditionalByName)}
          </p>
          <p className="bi-num mt-1 text-[11px] tabular-nums text-[var(--bi-ink-3)]">
            {formatPct(funnel.possibleAdditionalByNameRatePct, 2)} de los leads
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
            Leads que <strong>no</strong> empataron por teléfono, pero cuyo
            nombre completo y marca de carro coinciden con una revisión en
            fechas razonables. Es un empate débil —puede ser un homónimo—, así
            que <strong>no entra en el {formatPct(funnel.convertedRatePct, 2)}</strong>.
          </p>
          <p className="mt-3 border-t border-[var(--bi-ring)] pt-3 text-xs text-[var(--bi-ink-3)]">
            Si se contaran todos serían{" "}
            <span className="bi-num tabular-nums">
              {formatInt(funnel.convertedIncludingName)}
            </span>{" "}
            ({formatPct(pctOf(funnel.convertedIncludingName, funnel.leadsTotal), 2)}
            ). Es el máximo imaginable, no la cifra del negocio.
          </p>
        </BiCard>
      </div>

      {/* ---------- hueco declarado: no hay canal del lado del lead ----------
          Se rotula el hueco en vez de rellenarlo con un desglose inventado. La
          cifra sale de `byChannel`, no de un supuesto: si algún día Airtable
          empieza a mandar el origen, el aviso se encoge solo y desaparece. */}
      {channelMissing > 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--bi-ring)] bg-[var(--bi-surface)] px-4 py-3">
          <Info
            className="mt-0.5 size-4 shrink-0"
            style={{ color: "var(--bi-ink-3)" }}
            aria-hidden
          />
          <p className="text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
            <strong className="text-[var(--bi-ink)]">
              De dónde viene cada lead: no se sabe.
            </strong>{" "}
            Airtable no manda el origen —llega vacío en{" "}
            {formatInt(channelMissing)} de {formatInt(leads.total)} contactos—,
            así que este tablero no desglosa leads por canal. El canal solo se
            conoce del lado de la revisión, que sí registra por dónde entró el
            cliente.
          </p>
        </div>
      ) : null}

      {/* ---------- cómo se emparejó ---------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.9fr_1fr]">
        <BiCard
          className="min-w-0"
          title="Cómo se supo quién compró"
          subtitle={`${formatInt(funnel.leadsMatched)} contactos ligados a una revisión · ${formatInt(funnel.converted)} cuentan como conversión`}
          bodyClassName="pt-0"
        >
          <div className="-mx-4 overflow-x-auto pt-4 sm:-mx-5">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">
                Cómo se ligó cada contacto con su revisión, qué tan seguro es
                cada método y si cuenta en la conversión
              </caption>
              <thead>
                <tr className="border-b border-[var(--bi-ring)]">
                  {["Cómo se ligó", "Qué tan seguro", "Cuántos", "¿Cuenta?"].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        className={cn(
                          "bi-num px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--bi-ink-3)]",
                          /* La columna de números va a la derecha. Comparaba
                             contra «Emparejamientos», que se renombró en A136 y
                             dejó el encabezado desalineado de su columna. */
                          h === "Cuántos" && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {methodRows.map((m) => (
                  <tr
                    key={m.key}
                    className="border-b border-[var(--bi-ring)]/60 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="text-[13px] text-[var(--bi-ink)]">
                        {m.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--bi-ink-3)]">
                        {m.detail}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {/* La banda se distingue por relleno + rótulo, nunca por
                          color solo (A48): no inventamos hues sin validar. */}
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
                          m.counts
                            ? "border border-[var(--bi-income)]/60 text-[var(--bi-ink)]"
                            : "border border-[var(--bi-ring)] text-[var(--bi-ink-3)]",
                          m.band === "Alta" &&
                            "bg-[var(--bi-income)]/15",
                        )}
                      >
                        {m.band}
                      </span>
                    </td>
                    <td className="bi-num px-4 py-3 text-right text-[13px] tabular-nums text-[var(--bi-ink)]">
                      {formatInt(m.rows)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-[var(--bi-ink-2)]">
                        {m.counts ? (
                          <CheckCircle2
                            className="size-4 shrink-0"
                            style={{ color: "var(--bi-good)" }}
                            aria-hidden
                          />
                        ) : (
                          <MinusCircle
                            className="size-4 shrink-0"
                            style={{ color: "var(--bi-ink-3)" }}
                            aria-hidden
                          />
                        )}
                        {m.counts ? "Sí" : "No · estimación"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--bi-ring)]">
                  <td
                    className="px-4 py-3 text-[13px] font-semibold text-[var(--bi-ink)]"
                    colSpan={2}
                  >
                    Total
                  </td>
                  <td className="bi-num px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-[var(--bi-ink)]">
                    {formatInt(funnel.leadsMatched)}
                  </td>
                  <td className="bi-num px-4 py-3 text-[13px] font-semibold tabular-nums text-[var(--bi-ink)]">
                    {formatInt(funnel.converted)} cuentan
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </BiCard>

        <BiCard
          className="min-w-0"
          title="Contra qué revisión cruzó"
          subtitle={`Sobre los ${formatInt(funnel.leadsMatched)} contactos ligados a una revisión`}
        >
          <BiCountBars rows={targetRows} />
          <div className="mt-4 space-y-2 border-t border-[var(--bi-ring)] pt-3 text-xs text-[var(--bi-ink-3)]">
            <p>
              <span className="bi-num tabular-nums text-[var(--bi-ink-2)]">
                {formatInt(matches.ambiguous)}
              </span>{" "}
              emparejamientos salieron de un teléfono compartido por varios leads
              o varias revisiones; se desempataron por marca del carro y cercanía
              de fechas.
            </p>
            {matches.invalidIncome > 0 ? (
              <p>
                <span className="bi-num tabular-nums text-[var(--bi-ink-2)]">
                  {formatInt(matches.invalidIncome)}
                </span>{" "}
                cruzaron contra una revisión sin monto real (₡0 o ₡1.000) y por
                eso no cuentan como conversión.
              </p>
            ) : null}
          </div>
        </BiCard>
      </div>

      {/* ---------- calidad de los datos ---------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <BiCard
          className="min-w-0"
          title="Qué tan completos vienen los leads"
          subtitle={`Sobre ${formatInt(leads.total)} contactos`}
        >
          <BiCountBars rows={coverageRows} total={leads.total} />
          <div className="mt-4 space-y-1.5 border-t border-[var(--bi-ring)] pt-3 text-xs text-[var(--bi-ink-3)]">
            <p>
              <span className="bi-num tabular-nums text-[var(--bi-ink-2)]">
                {formatInt(leads.dupPhone8Groups)}
              </span>{" "}
              teléfonos aparecen en más de un lead ({formatInt(leads.dupPhone8ExcessRows)}{" "}
              contactos repetidos) y{" "}
              <span className="bi-num tabular-nums text-[var(--bi-ink-2)]">
                {formatInt(leads.dupManychatGroups)}
              </span>{" "}
              lo mismo por ManyChat ({formatInt(leads.dupManychatExcessRows)}).
            </p>
            <p>
              Se marcan y se conservan tal cual: fusionarlos rompería el estado
              que los bots llevan en Airtable. Para la conversión no inflan nada
              —cada lead recibe a lo sumo un emparejamiento—.
            </p>
          </div>
        </BiCard>

        {/**
         * **Los avisos NO siguen al periodo, y ahora lo dicen — A148.**
         *
         * `issuesByType` y `leadsPorRevisar` se calculan sobre **todos** los
         * leads: el resto de la pantalla se angostaba con el filtro y estas dos
         * cifras se quedaban quietas, sin una palabra que lo explicara. Un
         * número que no se mueve mientras el de al lado sí se lee como
         * congelado, o peor, como que el filtro no funciona.
         *
         * **Se decidió no filtrarlos, aunque se podría:** `leadsPorRevisarImpl`
         * ya cruza el aviso con su lead, así que la fecha del contacto está a
         * mano. Pero esto **no es una cuenta del periodo, es una lista de
         * pendientes**: recortarla escondería leads que siguen mal solo porque
         * entraron antes del lapso elegido, que es exactamente lo que A141
         * prohibió al filtrar Calidad — un filtro no puede esconder lo
         * accionable. Lo que faltaba era decirlo donde el número está (B44 ·
         * A126 · A133 · A144).
         */}
        <BiCard
          className="min-w-0"
          title="Avisos de calidad"
          subtitle={
            funnel.conPeriodo
              ? "Todo el histórico · lo esperado va aparte de lo accionable"
              : "Lo esperado va aparte de lo accionable"
          }
        >
          <div className="flex items-start gap-2.5">
            {actionableTotal > 0 ? (
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                style={{ color: "var(--bi-warn)" }}
                aria-hidden
              />
            ) : (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0"
                style={{ color: "var(--bi-good)" }}
                aria-hidden
              />
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--bi-ink)]">
                Para revisar ·{" "}
                <span className="bi-num tabular-nums">
                  {formatInt(actionableTotal)}
                </span>{" "}
                <span className="font-normal text-[var(--bi-ink-3)]">
                  avisos sobre {formatInt(leadsPorRevisarDistintos)} leads
                </span>
              </p>
              {actionableIssues.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--bi-ink-3)]">
                  Nada pendiente por revisar.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {actionableIssues.map((i) => (
                    <li key={i.issueType}>
                      <p className="text-[13px] text-[var(--bi-ink-2)]">
                        <span className="bi-num tabular-nums text-[var(--bi-ink)]">
                          {formatInt(i.rows)}
                        </span>{" "}
                        {ISSUE_LABELS[i.issueType] ?? i.issueType}
                      </p>
                      {ISSUE_NOTES[i.issueType] ? (
                        <p className="mt-0.5 text-xs text-[var(--bi-ink-3)]">
                          {ISSUE_NOTES[i.issueType]}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {actionableIssues.length > 0 ? (
                <p className="mt-2 text-xs text-[var(--bi-ink-3)]">
                  Están listados uno por uno más abajo, con el ID para buscarlos
                  en Airtable.
                </p>
              ) : null}
              {funnel.conPeriodo ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--bi-ink-3)]">
                  <b className="text-[var(--bi-ink-2)]">
                    Este bloque no sigue al periodo de arriba
                  </b>
                  : cuenta todos los leads, no solo los que entraron en ese
                  lapso. Es lo que falta corregir en Airtable, y algo que sigue
                  mal no deja de estarlo por haber entrado antes.
                </p>
              ) : null}
            </div>
          </div>

          {expectedIssues.length > 0 ? (
            <div className="mt-4 flex items-start gap-2.5 border-t border-[var(--bi-ring)] pt-4">
              <Info
                className="mt-0.5 size-4 shrink-0"
                style={{ color: "var(--bi-ink-3)" }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--bi-ink-2)]">
                  Esperado por diseño ·{" "}
                  <span className="bi-num tabular-nums">
                    {formatInt(
                      expectedIssues.reduce((s, i) => s + i.rows, 0),
                    )}
                  </span>
                </p>
                <ul className="mt-2 space-y-2">
                  {expectedIssues.map((i) => (
                    <li key={i.issueType}>
                      <p className="text-[13px] text-[var(--bi-ink-3)]">
                        <span className="bi-num tabular-nums">
                          {formatInt(i.rows)}
                        </span>{" "}
                        {ISSUE_LABELS[i.issueType] ?? i.issueType}
                      </p>
                      {ISSUE_NOTES[i.issueType] ? (
                        <p className="mt-0.5 text-xs text-[var(--bi-ink-3)]">
                          {ISSUE_NOTES[i.issueType]}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-[var(--bi-ink-3)]">
                  No son problemas y no suman al contador de arriba.
                </p>
              </div>
            </div>
          ) : null}
        </BiCard>
      </div>

      {/* ---------- listas consultables ---------- */}
      <div className="mt-4">
        <LeadsPorRevisarCard data={porRevisar} conPeriodo={funnel.conPeriodo} />
      </div>

      <div className="mt-4">
        <ConvertedLeadsCard rows={converted} />
      </div>
    </div>
  );
}
