/**
 * Control de inspecciones realizadas — **A114**.
 *
 * ## Qué contesta
 *
 * Tres preguntas de Esteban, en una sola lectura: **cuántas van** (histórico
 * completo, el mismo número que la portada), **en qué meses** y **quién las
 * hizo**. La tercera es la que tiene una limitación dura, y está dicha abajo.
 *
 * ## Por qué el total es el de la vista unificada y no el de `inspections`
 *
 * La pantalla de Inspecciones listaba solo la tabla `inspections` —lo que se
 * hizo **en la app**— y ese número (163) no se puede cruzar con nada: ni con las
 * 904 de la portada ni con los convertidos de Leads. El pedido era justamente
 * poder **corroborar** contra Leads, así que el titular sale de
 * `buildInspectionsAll` (A30): unión de legacy ∪ era-app, basura excluida,
 * solapes deduplicados. Es el mismo número que el resto del tablero **porque es
 * el mismo cálculo**, no porque coincida por casualidad.
 *
 * ## El hueco de «quién», que no se puede tapar
 *
 * `inspections_legacy` **no tiene campo de técnico**. El CRM viejo nunca lo
 * registró, así que de las 904 solo **163 se pueden atribuir** y las 741
 * restantes no van a poder atribuirse nunca — no es un dato pendiente de cargar,
 * es un dato que no se tomó. Se devuelve en `sinTecnico`, con su propio número,
 * y la tarjeta lo dice: repartirlas entre los dos técnicos que sí existen sería
 * inventar historia, y esconderlas haría leer «102 y 62» como si fueran todas.
 *
 * ## La fecha
 *
 * Se usa la de la vista unificada, que para la app es
 * `inspectionStartAt ?? _creationTime`. Medido sobre las 164 filas de PROD el
 * 1-set: 52 no traen `inspectionStartAt`, y de las 112 que sí, la diferencia
 * contra `_creationTime` **nunca pasa de 3 horas y ninguna cambia de mes**. Es
 * decir: el respaldo no mueve ningún mes, y por eso el desglose mensual de acá
 * cuadra con el de Finanzas y el de la portada.
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import {
  buildInspectionsAll,
  filterValidator,
  passesFilters,
  type FilterArgs,
} from "./metrics";
import { yearMonth } from "./lib/dates";

/** Etiqueta del balde de lo que no se puede atribuir (A64/A88). */
export const SIN_TECNICO = "(sin técnico registrado)";

export const inspeccionesReturns = v.object({
  /** Revisiones que pasan los filtros. */
  total: v.number(),
  /** Total sin ningún filtro — el ancla contra la que se compara todo. */
  totalHistorico: v.number(),
  /** ¿Hay algún filtro puesto? Cambia cómo se lee `total`. */
  conFiltros: v.boolean(),
  /** Desglose por origen, dentro de los filtros. */
  deLaApp: v.number(),
  delHistorico: v.number(),
  /** Serie mensual: el total y de dónde sale cada mes. */
  porMes: v.array(
    v.object({
      yearMonth: v.string(),
      total: v.number(),
      app: v.number(),
      legacy: v.number(),
    }),
  ),
  /**
   * Quién hizo cada una, ordenado por volumen. Solo cubre las de la app; las
   * históricas van en `sinTecnico` y NO aparecen acá como un técnico más.
   */
  porTecnico: v.array(
    v.object({
      technicianId: v.string(),
      nombre: v.string(),
      rows: v.number(),
      /** Primera y última revisión suyas dentro del filtro (epoch ms). */
      primeraMs: v.number(),
      ultimaMs: v.number(),
      /** Serie mensual propia, para ver relevos y estacionalidad. */
      porMes: v.array(v.object({ yearMonth: v.string(), rows: v.number() })),
    }),
  ),
  /** Revisiones sin técnico que se pueda saber (las del CRM viejo). */
  sinTecnico: v.number(),
  /** Cuántas SÍ se pueden atribuir — el denominador honesto de `porTecnico`. */
  atribuibles: v.number(),
  note: v.string(),
});

export async function inspeccionesImpl(ctx: QueryCtx, args: FilterArgs = {}) {
  const built = await buildInspectionsAll(ctx);
  const filas = built.all.filter((r) => passesFilters(r, args));

  const conFiltros = Object.values(args).some((v) => v != null);

  /* Nombres de los técnicos. Se leen una vez y se resuelven al final: la vista
     unificada guarda el `clerkUserId`, no el nombre, para no arrastrar PII por
     todo el cálculo. */
  const nombrePorClerk = new Map<string, string>();
  for (const u of await ctx.db.query("users").collect()) {
    nombrePorClerk.set(u.clerkId, u.name?.trim() || u.email || u.clerkId);
  }

  const meses = new Map<string, { total: number; app: number; legacy: number }>();
  const tecnicos = new Map<
    string,
    {
      rows: number;
      primeraMs: number;
      ultimaMs: number;
      meses: Map<string, number>;
    }
  >();
  let deLaApp = 0;
  let sinTecnico = 0;

  for (const r of filas) {
    const ym = yearMonth(r.date);
    const m = meses.get(ym) ?? { total: 0, app: 0, legacy: 0 };
    m.total++;
    if (r.source === "era_app") {
      m.app++;
      deLaApp++;
    } else {
      m.legacy++;
    }
    meses.set(ym, m);

    if (!r.technicianId) {
      sinTecnico++;
      continue;
    }
    const t = tecnicos.get(r.technicianId) ?? {
      rows: 0,
      primeraMs: r.date,
      ultimaMs: r.date,
      meses: new Map<string, number>(),
    };
    t.rows++;
    if (r.date < t.primeraMs) t.primeraMs = r.date;
    if (r.date > t.ultimaMs) t.ultimaMs = r.date;
    t.meses.set(ym, (t.meses.get(ym) ?? 0) + 1);
    tecnicos.set(r.technicianId, t);
  }

  const porMes = [...meses.entries()]
    .map(([yearMonth, m]) => ({ yearMonth, ...m }))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

  const porTecnico = [...tecnicos.entries()]
    .map(([technicianId, t]) => ({
      technicianId,
      /* Un técnico que ya no está en `users` (cuenta borrada) no puede
         desaparecer del conteo: sus revisiones ocurrieron. Se muestra con su id
         recortado, que es feo a propósito — un nombre inventado sería peor. */
      nombre: nombrePorClerk.get(technicianId) ?? `Usuario ${technicianId.slice(-6)}`,
      rows: t.rows,
      primeraMs: t.primeraMs,
      ultimaMs: t.ultimaMs,
      porMes: [...t.meses.entries()]
        .map(([yearMonth, rows]) => ({ yearMonth, rows }))
        .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)),
    }))
    .sort((a, b) => b.rows - a.rows);

  return {
    total: filas.length,
    totalHistorico: built.all.length,
    conFiltros,
    deLaApp,
    delHistorico: filas.length - deLaApp,
    porMes,
    porTecnico,
    sinTecnico,
    atribuibles: filas.length - sinTecnico,
    note: "Total = inspections_all (A30): unión legacy ∪ era-app, basura excluida, solapes deduplicados — el mismo número que la portada. «Quién» solo existe del lado app: inspections_legacy no tiene campo de técnico y esas filas van en sinTecnico, no repartidas (A114).",
  };
}

export const inspecciones = internalQuery({
  args: { ...filterValidator },
  returns: inspeccionesReturns,
  handler: async (ctx, args) => inspeccionesImpl(ctx, args),
});
