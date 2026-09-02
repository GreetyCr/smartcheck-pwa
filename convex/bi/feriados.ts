/**
 * Calendario de feriados y su cruce con las revisiones — **RF-20 · RF-21 ·
 * RF-22** (A117).
 *
 * ## Qué lo separa de un almanaque
 *
 * Mostrar doce fechas no le sirve a nadie: eso ya está en el teléfono. Lo que
 * Esteban no puede saber solo es **si se trabajó en un feriado de pago
 * obligatorio**, porque eso obliga a pagar doble ese día (Código de Trabajo,
 * art. 152) y él paga por revisión, no por día. Así que cada feriado viene con
 * las revisiones que cayeron encima y de qué lado salieron.
 *
 * **El tamaño real, medido en PROD el 1-set-2026**: de las 904 revisiones,
 * **12 cayeron en feriado** — 8 del histórico y 4 de la app. De esas 4, todas en
 * feriado de pago obligatorio. No es un agujero de plata, es un aviso: sirve
 * para no llegar tarde, no para recuperar nada.
 *
 * ## Lo que NO hace, y por qué
 *
 * **No calcula cuánto pagar de más.** Sabe qué revisiones cayeron en feriado
 * obligatorio, pero el doble se aplica sobre la jornada, y acá el técnico cobra
 * viático por revisión más comisión a partir de la 46 del mes: cómo se traduce
 * eso a «doble» es una decisión de Esteban con su contador, no nuestra. La
 * pantalla pone los hechos —qué día, cuántas, quién— y deja la cuenta a quien
 * corresponde. Inventar la fórmula sería el tipo de número que se copia a una
 * planilla y nadie vuelve a cuestionar.
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { buildInspectionsAll } from "./metrics";
import { isoDate, nowMs } from "./lib/dates";
import {
  ANIOS_CUBIERTOS,
  ULTIMA_VERIFICACION,
  anioCubierto,
  feriadoDe,
  feriadosDelAnio,
} from "./lib/feriados";

/** Cuántos feriados próximos se anuncian (RF-22). */
export const PROXIMOS = 3;

export const feriadosReturns = v.object({
  /** Año que se está mostrando. */
  anio: v.number(),
  /** ¿La tabla cubre ese año? Si es `false`, `delAnio` viene vacío **y se dice**. */
  cubierto: v.boolean(),
  /** Los años que la tabla conoce, para que la pantalla no ofrezca otros. */
  aniosCubiertos: v.array(v.number()),
  /** Fecha en que la lista se contrastó contra la fuente legal. */
  verificadoAl: v.string(),
  /** El calendario del año, con lo que pasó cada día. */
  delAnio: v.array(
    v.object({
      fecha: v.string(),
      nombre: v.string(),
      /** `obligatorio` | `no_obligatorio`. */
      tipo: v.string(),
      /** Día de la semana en español, ya resuelto en zona CR. */
      diaSemana: v.string(),
      /** ¿Ya pasó? */
      pasado: v.boolean(),
      /** Revisiones hechas ese día. */
      revisiones: v.number(),
      revisionesApp: v.number(),
      revisionesHistorico: v.number(),
    }),
  ),
  /** Los próximos, contados desde hoy (RF-22). */
  proximos: v.array(
    v.object({
      fecha: v.string(),
      nombre: v.string(),
      tipo: v.string(),
      diaSemana: v.string(),
      /** Días que faltan. 0 = hoy. */
      faltanDias: v.number(),
    }),
  ),
  /** Total histórico de revisiones caídas en feriado de pago obligatorio. */
  revisionesEnObligatorio: v.number(),
  /** Ídem en feriados de pago no obligatorio. */
  revisionesEnNoObligatorio: v.number(),
  note: v.string(),
});

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/** Día de la semana de un `"YYYY-MM-DD"` leído como fecha de Costa Rica. */
function diaSemanaDe(iso: string): string {
  // Mediodía UTC evita que el desfase de zona corra el día en los extremos.
  return DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

const DIA_MS = 86_400_000;

export async function feriadosImpl(
  ctx: QueryCtx,
  { anio, ahoraMs }: { anio?: number; ahoraMs?: number } = {},
) {
  const ahora = ahoraMs ?? nowMs();
  const hoyIso = isoDate(ahora);
  const anioPedido = anio ?? Number(hoyIso.slice(0, 4));

  /* Cuántas revisiones cayeron en cada feriado. Se recorre la vista unificada
     —no `inspections`— para que el conteo incluya el histórico del CRM y cuadre
     con el resto del tablero. */
  const built = await buildInspectionsAll(ctx);
  const porDia = new Map<string, { app: number; legacy: number }>();
  let revisionesEnObligatorio = 0;
  let revisionesEnNoObligatorio = 0;
  for (const r of built.all) {
    const dia = isoDate(r.date);
    const fer = feriadoDe(dia);
    if (!fer) continue;
    const acc = porDia.get(dia) ?? { app: 0, legacy: 0 };
    if (r.source === "era_app") acc.app++;
    else acc.legacy++;
    porDia.set(dia, acc);
    if (fer.tipo === "obligatorio") revisionesEnObligatorio++;
    else revisionesEnNoObligatorio++;
  }

  const delAnio = feriadosDelAnio(anioPedido).map((f) => {
    const acc = porDia.get(f.fecha) ?? { app: 0, legacy: 0 };
    return {
      fecha: f.fecha,
      nombre: f.nombre,
      tipo: f.tipo,
      diaSemana: diaSemanaDe(f.fecha),
      pasado: f.fecha < hoyIso,
      revisiones: acc.app + acc.legacy,
      revisionesApp: acc.app,
      revisionesHistorico: acc.legacy,
    };
  });

  /* Los próximos salen de TODOS los años cubiertos, no solo del que se está
     mirando: en diciembre lo siguiente está en enero, y un aviso que se apaga el
     último mes del año es justo el que hace falta. */
  const proximos = ANIOS_CUBIERTOS.flatMap((a) => feriadosDelAnio(a))
    .filter((f) => f.fecha >= hoyIso)
    .slice(0, PROXIMOS)
    .map((f) => ({
      fecha: f.fecha,
      nombre: f.nombre,
      tipo: f.tipo,
      diaSemana: diaSemanaDe(f.fecha),
      faltanDias: Math.round(
        (Date.parse(`${f.fecha}T00:00:00-06:00`) -
          Date.parse(`${hoyIso}T00:00:00-06:00`)) /
          DIA_MS,
      ),
    }));

  return {
    anio: anioPedido,
    cubierto: anioCubierto(anioPedido),
    aniosCubiertos: ANIOS_CUBIERTOS,
    verificadoAl: ULTIMA_VERIFICACION,
    delAnio,
    proximos,
    revisionesEnObligatorio,
    revisionesEnNoObligatorio,
    note: "Feriados de Costa Rica con fechas explícitas por año (el 12 de octubre dejó de ser feriado con la Ley 9803; el traslado a lunes caducó en 2024). Pago obligatorio: se paga aunque no se trabaje, y doble si se trabaja (CT art. 152). Las revisiones salen de inspections_all, así que cuadran con el resto del tablero.",
  };
}

export const feriados = internalQuery({
  args: { anio: v.optional(v.number()), ahoraMs: v.optional(v.number()) },
  returns: feriadosReturns,
  handler: async (ctx, args) => feriadosImpl(ctx, args),
});
