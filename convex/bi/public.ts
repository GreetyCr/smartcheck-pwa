/**
 * Superficie de LECTURA pública del BI para el dashboard (A40 · A41).
 *
 * Cada query gatea con `requireAdmin`. Las funciones de cómputo del BI siguen
 * siendo `internal` (blindaje A23) y **eso se conserva a propósito**: la versión
 * internal se invoca desde el CLI y los scripts de verificación, donde no hay
 * identidad y `requireAdmin` fallaría. Así cada indicador tiene dos puertas —una
 * para el navegador, con auth; otra para nosotros, sin ella— y **un solo cálculo**.
 *
 * En Convex una `query` no puede `ctx.runQuery` (A41), así que la internal y la
 * pública no pueden llamarse entre sí: ambas invocan el mismo helper plano
 * (`*Impl` / `compute*`) exportado por su módulo. Lo que A41 prohíbe es llamar a
 * otra *función de Convex*; pasarle `ctx` a un helper normal es legítimo.
 *
 * Al agregar un tablero: extraer el cómputo a un helper, exportar la forma de
 * retorno como `*Returns`, y agregar acá el wrapper. Nada de lógica en este
 * archivo — si aparece una regla de negocio acá, está en el lugar equivocado.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import {
  buildInspectionsAll,
  computeFinanceSummary,
  computeTotalRevisiones,
  executiveSummaryImpl,
  executiveSummaryReturns,
  financeSummaryReturns,
  reconciliationImpl,
  reconciliationReturns,
  totalRevisionesReturns,
  filterValidator,
} from "./metrics";
import {
  conversionFunnelImpl,
  conversionFunnelReturns,
  convertedLeadsImpl,
  convertedLeadsReturns,
  leadPeriodValidator,
  matchesStatsImpl,
  matchesStatsReturns,
} from "./matches";
import {
  leadsPorRevisarImpl,
  leadsPorRevisarReturns,
  leadsStatsImpl,
  leadsStatsReturns,
} from "./leads";
import { breakdownReturns, expenseBreakdownImpl } from "./expenseGroups";
import {
  channelFilterValidator,
  channelRevenueImpl,
  channelRevenueReturns,
} from "./channels";
import { pagosTecnicoImpl, pagosTecnicoReturns } from "./pagosTecnico";
import { calidadImpl, calidadReturns } from "./calidad";
import { estadoDatosImpl, estadoDatosReturns } from "./estadoDatos";
import { operacionImpl, operacionReturns } from "./operacion";
import { filterOptionsImpl, filterOptionsReturns } from "./filtros";
import { inspeccionesImpl, inspeccionesReturns } from "./inspecciones";
import { feriadosImpl, feriadosReturns } from "./feriados";
import { contrasteImpl, contrasteReturns } from "./contraste";

/* -------------------------------------------------------------------------- */
/* Finanzas                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Resumen financiero para el tab de Finanzas: serie mensual
 * (ingresos/gastos/utilidad/margen) + totales + viáticos. Opcionalmente acotable
 * por rango `[fromMs, toMs)`.
 */
export const financeSummary = query({
  args: { fromMs: v.optional(v.number()), toMs: v.optional(v.number()) },
  returns: financeSummaryReturns,
  handler: async (ctx, { fromMs, toMs }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("finance_entries").collect();
    return computeFinanceSummary(rows, fromMs, toMs);
  },
});

/* -------------------------------------------------------------------------- */
/* Revisiones y resumen ejecutivo                                             */
/* -------------------------------------------------------------------------- */

/**
 * Total de revisiones y sus desgloses (mes, provincia, agencia, motor, canal,
 * fuente). Es la unión legacy ∪ era-app deduplicada (A30), no una tabla.
 */
export const totalRevisiones = query({
  args: { ...filterValidator },
  returns: totalRevisionesReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return computeTotalRevisiones(await buildInspectionsAll(ctx), args);
  },
});

/** Cifras de portada: revisiones, ingresos, utilidad, conversión. */
export const executiveSummary = query({
  args: { ...filterValidator },
  returns: executiveSummaryReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return executiveSummaryImpl(ctx, args);
  },
});

/**
 * Conciliación finanzas ↔ inspecciones, mes a mes.
 *
 * Ojo al leerla en el tablero: el **mes en curso** viene con `enCurso:true` y no
 * se marca `significant` — su gap negativo es el desfase normal entre hacer la
 * revisión y cobrarla (A59). Para comparar contra meses cerrados, usar
 * `totals.gapPctMesesCerrados`.
 */
export const reconciliation = query({
  args: { fromMs: v.optional(v.number()), toMs: v.optional(v.number()) },
  returns: reconciliationReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return reconciliationImpl(ctx, args);
  },
});

/* -------------------------------------------------------------------------- */
/* Leads y conversión                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Embudo lead → cliente. La métrica titular es `converted` (emparejamiento por
 * teléfono, bandas alta+media — A29); `possibleAdditionalByName` es un fallback
 * débil que se muestra **aparte**, nunca sumado al titular.
 */
export const conversionFunnel = query({
  args: { sampleSize: v.optional(v.number()), ...leadPeriodValidator },
  returns: conversionFunnelReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return conversionFunnelImpl(ctx, args);
  },
});

/** Detalle del emparejamiento: por método, banda, destino y ambigüedades. */
export const matchesStats = query({
  args: {},
  returns: matchesStatsReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return matchesStatsImpl(ctx);
  },
});

/**
 * Calidad de los leads: cobertura de teléfono/nombre/manychat, duplicados e
 * issues por tipo. El grueso de `lead_dup` es **ruido esperado por diseño**
 * (A26: se marcan, no se fusionan) — el tablero tiene que separarlo de lo
 * accionable o se lee como si hubiera 1.900 problemas.
 */
export const leadsStats = query({
  args: { ...leadPeriodValidator },
  returns: leadsStatsReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return leadsStatsImpl(ctx, args);
  },
});

/**
 * Todos los que convirtieron —no una muestra—, para paginar y filtrar en el
 * tablero. Mismo criterio que la métrica titular: `validIncome`, bandas
 * alta+media. Trae nombre y teléfono, así que es PII: solo-admin, y no debe
 * salir a logs.
 */
export const convertedLeads = query({
  args: { ...leadPeriodValidator },
  returns: convertedLeadsReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return convertedLeadsImpl(ctx, args);
  },
});

/**
 * Los leads que piden acción, con el `airtableId` para poder ir a corregirlos.
 * NO incluye `lead_dup`: es ruido esperado por diseño (A26) y ahogaría la lista.
 */
export const leadsPorRevisar = query({
  args: {},
  returns: leadsPorRevisarReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return leadsPorRevisarImpl(ctx);
  },
});

/**
 * Desglose de «Otros» en los seis grupos que aprobó Esteban (A83).
 *
 * No mueve ni un colón de la utilidad: es la misma plata, mejor ordenada. Por
 * eso se puede cambiar el mapeo sin miedo — lo peor que puede pasar es que un
 * proveedor aparezca en «sin clasificar», que es visible a propósito.
 */
export const expenseBreakdown = query({
  args: { fromMs: v.optional(v.number()), toMs: v.optional(v.number()) },
  returns: breakdownReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return expenseBreakdownImpl(ctx, args);
  },
});

/**
 * Ingresos por canal (F3). Los ingresos de acá salen de las **revisiones**, no
 * de `finance_entries`: no cuadran con el P&L y la nota del retorno lo dice.
 */
export const channelRevenue = query({
  args: { ...channelFilterValidator },
  returns: channelRevenueReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return channelRevenueImpl(ctx, args);
  },
});

/**
 * Viáticos y comisión del técnico para un mes (B36).
 *
 * Cuenta **solo las revisiones del técnico** y corta por **semanas de lunes a
 * domingo**, asignadas al mes en que arrancaron. Los dos detalles vienen de
 * Esteban y son los que hacían que su conteo no fuera el nuestro.
 */
export const pagosTecnico = query({
  args: { yearMonth: v.string() },
  returns: pagosTecnicoReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return pagosTecnicoImpl(ctx, args);
  },
});

/**
 * Calidad de los datos (F3).
 *
 * Devuelve los avisos **clasificados por un catálogo escrito**, no por su
 * severidad: en producción hay 2.158 y 1.869 son duplicados que se marcan a
 * propósito (A26). Sin esa separación el tablero enseña a ignorarse.
 */
export const calidad = query({
  args: {},
  returns: calidadReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return calidadImpl(ctx);
  },
});

/**
 * Frescura y estado de cada proceso (**RF-09** · **RF-16**). El dato vivía en
 * `bi_meta` desde el principio; lo que faltaba era quién lo leyera.
 */
export const estadoDatos = query({
  args: {},
  returns: estadoDatosReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return estadoDatosImpl(ctx);
  },
});

/**
 * Calidad **& operación** de las revisiones (**RF-07**): hallazgos frecuentes,
 * condición del vehículo y SLA de respuesta.
 *
 * Ojo al leerla: la polaridad de cada ítem sale del catálogo del formulario, no
 * de una tabla propia — 18 de los 44 ítems sí/no son hallazgo cuando la
 * respuesta es **no**. Y el SLA se calcula solo sobre las entregadas que tienen
 * las dos fechas; `sinFechaInicio` dice cuántas quedaron fuera.
 */
/**
 * Opciones de la barra de filtros global (**RF-02**), derivadas de los datos y
 * **con la cuenta de cada una**. También devuelve qué dimensiones del
 * requerimiento no se pueden servir hoy y por qué, para que la barra lo diga.
 */
export const filterOptions = query({
  args: {},
  returns: filterOptionsReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return filterOptionsImpl(ctx);
  },
});

/**
 * Contraste mensual **hoja ↔ Convex** (**A56**): en qué meses dejaron de
 * coincidir, y en cuáles la hoja no cuadra ni consigo misma.
 */
export const contrasteHoja = query({
  args: {},
  returns: contrasteReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return contrasteImpl(ctx);
  },
});

export const operacion = query({
  args: { ...filterValidator },
  returns: operacionReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return operacionImpl(ctx, args);
  },
});

/**
 * Control de inspecciones realizadas (**A114**): total histórico, desglose
 * mensual y quién las hizo. El titular sale de la vista unificada, así que
 * **cuadra con la portada** — que es para lo que se pidió: poder corroborar.
 *
 * Devuelve nombres de técnicos, o sea PII de personal: solo-admin, y no debe
 * salir a logs.
 */
export const inspecciones = query({
  args: { ...filterValidator },
  returns: inspeccionesReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return inspeccionesImpl(ctx, args);
  },
});

/**
 * Calendario de feriados de Costa Rica (**RF-20 · RF-21 · RF-22**), con las
 * revisiones que cayeron en cada uno. Sin PII: fechas y conteos.
 */
export const feriados = query({
  args: { anio: v.optional(v.number()) },
  returns: feriadosReturns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return feriadosImpl(ctx, args);
  },
});
