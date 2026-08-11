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
  matchesStatsImpl,
  matchesStatsReturns,
} from "./matches";
import {
  leadsPorRevisarImpl,
  leadsPorRevisarReturns,
  leadsStatsImpl,
  leadsStatsReturns,
} from "./leads";

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
  args: { sampleSize: v.optional(v.number()) },
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
  args: {},
  returns: leadsStatsReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return leadsStatsImpl(ctx);
  },
});

/**
 * Todos los que convirtieron —no una muestra—, para paginar y filtrar en el
 * tablero. Mismo criterio que la métrica titular: `validIncome`, bandas
 * alta+media. Trae nombre y teléfono, así que es PII: solo-admin, y no debe
 * salir a logs.
 */
export const convertedLeads = query({
  args: {},
  returns: convertedLeadsReturns,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return convertedLeadsImpl(ctx);
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
