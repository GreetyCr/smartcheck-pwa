/**
 * Correcciones puntuales sobre el histórico, autorizadas por Esteban el
 * 24-ago-2026 (**B37**).
 *
 * Son tres cosas distintas y **cada una es su propia mutation**, no un botón que
 * hace todo: si una sale mal, se revierte sola sin arrastrar a las otras.
 *
 *  1. `corregirAportePatronalMarzo` — marzo quedó al 31,57% por un error de la
 *     hoja. Él eligió corregir **solo el aporte patronal**, no rehacer el mes.
 *  2. `moverViaticosAGasolina` — los viáticos históricos viven en `otros` y
 *     desde agosto los captura en `gasolina`. Quedaban partidos en dos lugares.
 *  3. `refecharFijosAgosto` — los fijos de agosto están al día 30 y él los
 *     quiere **al último día de cada mes**. Agosto tiene 31.
 *
 * ---
 *
 * **Todas arrancan en `dryRun`**, igual que `fixSheetTaxonomy`: hay que pedir
 * explícitamente que apliquen. Y todas devuelven el **antes y el después de cada
 * fila que tocan**, que es el respaldo: leer la tabla desde el CLI no sirve para
 * eso porque las notas de la migración traen `|` adentro y corren las columnas.
 *
 * Ninguna borra nada. Todas son **idempotentes**: correrlas dos veces no cambia
 * nada la segunda vez, porque cada una se salta las filas que ya están como
 * deberían.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { crMidnightMs } from "./lib/dates";

/** Etiqueta del Sheet dentro de `externalKey` ("sheet:<mes>:<ETIQUETA>:<n>"). */
function sheetLabel(externalKey: string | undefined): string {
  return (externalKey ?? "").split(":")[2]?.toUpperCase() ?? "";
}

const cambioRow = v.object({
  id: v.string(),
  etiqueta: v.string(),
  antes: v.string(),
  despues: v.string(),
  amountCRC: v.number(),
});

/* -------------------------------------------------------------------------- */
/* 1 · Marzo: el aporte patronal quedó al 31,57%                              */
/* -------------------------------------------------------------------------- */

const MARZO_KEY = "sheet:MARZO 2026:APORTE PATRONO CCSS:1";
/** Lo que dice la hoja hoy: 430.000 × 31,57%. */
const MARZO_MAL = 135_760;
/** Lo que debería decir: 430.000 × 26,92%, la tasa de la vigencia de marzo. */
const MARZO_BIEN = 115_756;

/**
 * Corrige **solo el aporte patronal** de marzo.
 *
 * Esteban eligió esta opción sobre rehacer el mes completo. Vale la pena dejar
 * escrito lo que **no** se toca, porque marzo tiene tres rarezas más y alguien
 * las va a encontrar después: no tiene línea de impuestos, sus vacaciones son
 * ₡20.000 redondos en vez de los ₡20.957 de la fórmula, y en lugar de preaviso y
 * cesantía tiene una sola `PROVISION DESPIDO` de ₡100.000. Nada de eso se
 * modifica: la decisión fue el aporte patronal y nada más.
 */
export const corregirAportePatronalMarzo = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    dryRun: v.boolean(),
    cambios: v.array(cambioRow),
    yaEstaba: v.boolean(),
    deltaCRC: v.number(),
  }),
  handler: async (ctx, { dryRun }) => {
    const isDry = dryRun !== false; // seguro por defecto

    const fila = await ctx.db
      .query("finance_entries")
      .withIndex("by_external_key", (q) => q.eq("externalKey", MARZO_KEY))
      .unique();

    if (!fila || fila.isDeleted) {
      return { dryRun: isDry, cambios: [], yaEstaba: false, deltaCRC: 0 };
    }
    if (fila.amountCRC === MARZO_BIEN) {
      return { dryRun: isDry, cambios: [], yaEstaba: true, deltaCRC: 0 };
    }
    if (fila.amountCRC !== MARZO_MAL) {
      // Ni el valor malo ni el bueno: alguien lo tocó y no sabemos qué quiso.
      throw new Error(
        `Marzo tiene ₡${fila.amountCRC}, que no es ni ₡${MARZO_MAL} ni ₡${MARZO_BIEN}. No se toca a ciegas.`,
      );
    }

    const cambios = [
      {
        id: fila._id,
        etiqueta: sheetLabel(fila.externalKey),
        antes: `₡${fila.amountCRC}`,
        despues: `₡${MARZO_BIEN}`,
        amountCRC: fila.amountCRC,
      },
    ];

    if (!isDry) {
      await ctx.db.patch(fila._id, {
        amountCRC: MARZO_BIEN,
        originalAmount: MARZO_BIEN,
        note: `${fila.note ? `${fila.note} · ` : ""}corregido 24-ago-2026: 31,57%→26,92% (B30/B37)`,
        updatedAt: Date.now(),
      });
    }

    return {
      dryRun: isDry,
      cambios,
      yaEstaba: false,
      deltaCRC: MARZO_BIEN - fila.amountCRC,
    };
  },
});

/* -------------------------------------------------------------------------- */
/* 2 · Los viáticos históricos van a `gasolina`                               */
/* -------------------------------------------------------------------------- */

/**
 * Mueve los viáticos del técnico de `otros` a `gasolina`.
 *
 * Se seleccionan **por la etiqueta de la hoja**, no por el flag `isViatico`. El
 * flag es más ancho —lo lleva cualquier gasto variable de `otros`— y arrastraría
 * filas que no son viáticos. La etiqueta dice literalmente `VIATICOS DEL 14 AL
 * 20` o `VIATICOS TECNICO`, que es exactamente lo que Esteban quiso mover.
 *
 * El flag no hay que tocarlo: `gasolina` tampoco está en `FORCE_NON_VIATICO`
 * (B22), así que estas filas siguen contando como viático igual que antes.
 */
export const moverViaticosAGasolina = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    dryRun: v.boolean(),
    cambios: v.array(cambioRow),
    totalCRC: v.number(),
    /** Filas de `otros` marcadas como viático que NO se mueven, por no llamarse así. */
    omitidasPorEtiqueta: v.number(),
  }),
  handler: async (ctx, { dryRun }) => {
    const isDry = dryRun !== false;

    const cambios: Array<{
      id: string;
      etiqueta: string;
      antes: string;
      despues: string;
      amountCRC: number;
    }> = [];
    let totalCRC = 0;
    let omitidasPorEtiqueta = 0;

    for (const f of await ctx.db.query("finance_entries").collect()) {
      if (f.isDeleted || f.kind !== "expense" || f.category !== "otros") continue;

      const etiqueta = sheetLabel(f.externalKey) || (f.note ?? "").toUpperCase();
      if (!etiqueta.includes("VIATICO") && !etiqueta.includes("VIÁTICO")) {
        if (f.isViatico) omitidasPorEtiqueta++;
        continue;
      }

      cambios.push({
        id: f._id,
        etiqueta,
        antes: "otros",
        despues: "gasolina",
        amountCRC: f.amountCRC,
      });
      totalCRC += f.amountCRC;

      if (!isDry) {
        await ctx.db.patch(f._id, { category: "gasolina", updatedAt: Date.now() });
      }
    }

    return { dryRun: isDry, cambios, totalCRC, omitidasPorEtiqueta };
  },
});

/* -------------------------------------------------------------------------- */
/* 3 · Los fijos de agosto, al último día del mes                             */
/* -------------------------------------------------------------------------- */

const AGOSTO_MAL = "2026-08-30";
const AGOSTO_BIEN = "2026-08-31";

/**
 * Mueve del 30 al 31 los gastos fijos de agosto.
 *
 * Esteban confirmó que quiere los fijos **al último día de cada mes** porque en
 * esa fecha paga por adelantado el mes siguiente. Agosto tiene 31 días y quedaron
 * al 30.
 *
 * **Solo gastos, y nunca los que genera el sistema.** Un ingreso o una fila de
 * `source: "inspection"` fechada ese día sería una revisión real de ese día y
 * moverla la sacaría de su fecha verdadera. Acá no hay ninguna —agosto todavía no
 * llega al 30— pero la regla tiene que estar escrita antes de que la haya.
 */
export const refecharFijosAgosto = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    dryRun: v.boolean(),
    cambios: v.array(cambioRow),
    omitidas: v.number(),
  }),
  handler: async (ctx, { dryRun }) => {
    const isDry = dryRun !== false;
    const desde = crMidnightMs(AGOSTO_MAL);
    const hasta = crMidnightMs(AGOSTO_BIEN);

    const cambios: Array<{
      id: string;
      etiqueta: string;
      antes: string;
      despues: string;
      amountCRC: number;
    }> = [];
    let omitidas = 0;

    const filas = await ctx.db
      .query("finance_entries")
      .withIndex("by_year_month", (q) => q.eq("yearMonth", "2026-08"))
      .collect();

    for (const f of filas) {
      if (f.isDeleted || f.date !== desde) continue;
      if (f.kind !== "expense" || f.source === "inspection") {
        omitidas++;
        continue;
      }

      cambios.push({
        id: f._id,
        etiqueta: sheetLabel(f.externalKey) || (f.note ?? "(sin etiqueta)"),
        antes: AGOSTO_MAL,
        despues: AGOSTO_BIEN,
        amountCRC: f.amountCRC,
      });

      if (!isDry) {
        await ctx.db.patch(f._id, { date: hasta, updatedAt: Date.now() });
      }
    }

    return { dryRun: isDry, cambios, omitidas };
  },
});
