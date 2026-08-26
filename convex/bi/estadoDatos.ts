/**
 * Estado y frescura de los datos (**RF-09** · **RF-16**).
 *
 * El requerimiento lo dice en una línea: *«no mostrar datos viejos en
 * silencio»*. Hasta ahora `bi_meta` guardaba la hora y el resultado de cada
 * proceso —y el cron los escribía puntualmente— pero **no había pantalla que
 * los mostrara**: si el sync del lunes fallaba, el tablero seguía enseñando los
 * números de la semana pasada como si fueran de hoy. La vigilancia existía y era
 * muda.
 *
 * ---
 *
 * **La distinción que hace útil el aviso: no todo proceso envejece.**
 *
 * `leads_sync`, `leads_reconcile` y `matches_rebuild` corren **cada lunes**, así
 * que pasar de una semana sin correr es una señal real. Pero
 * `finance_migration` y `legacy_migration` fueron **cargas únicas** de julio y
 * nunca van a volver a correr: medirlas contra el reloj las mostraría con 31
 * días de atraso para siempre. Un aviso que está encendido siempre no es un
 * aviso, es decoración — y entrena a ignorar el que sí importa.
 *
 * Por eso cada proceso declara su **cadencia**, y solo los periódicos se
 * evalúan contra el reloj.
 */
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";

/** Cada cuánto se espera que corra un proceso. */
export type Cadencia = "semanal" | "unica";

type Meta = { etiqueta: string; cadencia: Cadencia; queEs: string };

/**
 * Los procesos que alimentan el tablero. **Este es el único lugar donde se
 * declara qué se espera de cada uno.**
 */
export const PROCESOS: Record<string, Meta> = {
  leads_sync: {
    etiqueta: "Contactos desde Airtable",
    cadencia: "semanal",
    queEs: "Trae los contactos nuevos y actualiza los que cambiaron.",
  },
  leads_reconcile: {
    etiqueta: "Revisión de contactos",
    cadencia: "semanal",
    queEs: "Comprueba que lo que hay acá siga cuadrando con Airtable.",
  },
  matches_rebuild: {
    etiqueta: "Enlace contacto ↔ revisión",
    cadencia: "semanal",
    queEs: "Recalcula quién de los contactos terminó siendo cliente.",
  },
  finance_migration: {
    etiqueta: "Carga inicial de finanzas",
    cadencia: "unica",
    queEs: "La carga de la hoja de cálculo. Se hizo una vez y no se repite.",
  },
  legacy_migration: {
    etiqueta: "Carga del sistema anterior",
    cadencia: "unica",
    queEs: "Las revisiones del CRM viejo. Se hizo una vez y no se repite.",
  },
  sheet_contrast: {
    etiqueta: "Contraste con la hoja de cálculo",
    cadencia: "semanal",
    queEs:
      "Compara mes a mes lo que hay acá contra la hoja, por si algo cambió allá.",
  },
};

/**
 * A partir de cuántos días sin correr se considera atrasado un proceso semanal.
 *
 * Ocho, no siete: el cron corre los lunes, así que un domingo por la noche un
 * proceso sano lleva legítimamente seis días y pico. Con siete, el aviso se
 * encendería todos los domingos.
 */
export const DIAS_PARA_ATRASO = 8;

const MS_DIA = 24 * 60 * 60 * 1000;

const procesoRow = v.object({
  key: v.string(),
  etiqueta: v.string(),
  queEs: v.string(),
  cadencia: v.string(),
  lastRunAt: v.number(),
  lastStatus: v.string(),
  message: v.union(v.string(), v.null()),
  rowsProcessed: v.union(v.number(), v.null()),
  /** Días desde la última corrida, con un decimal. */
  diasDesde: v.number(),
  /** Solo para los periódicos: hace más de `DIAS_PARA_ATRASO` que no corre. */
  atrasado: v.boolean(),
});

export const estadoDatosReturns = v.object({
  procesos: v.array(procesoRow),
  /** Instante de la corrida más reciente entre los procesos periódicos. */
  ultimaActualizacion: v.union(v.number(), v.null()),
  hayError: v.boolean(),
  hayAtraso: v.boolean(),
  /** Claves de `bi_meta` que no están declaradas en `PROCESOS`. */
  sinDeclarar: v.array(v.string()),
  diasParaAtraso: v.number(),
});

/** Cómputo puro (recibe `ctx`), compartido por la internal y la pública (A41). */
export async function estadoDatosImpl(ctx: QueryCtx) {
  const ahora = Date.now();
  const filas = await ctx.db.query("bi_meta").collect();
  const sinDeclarar: string[] = [];

  const procesos = filas
    .map((f) => {
      const meta = PROCESOS[f.key];
      if (!meta) sinDeclarar.push(f.key);
      const m: Meta = meta ?? {
        etiqueta: f.key,
        cadencia: "semanal",
        queEs: "Proceso nuevo, todavía sin describir.",
      };
      const diasDesde = Math.round(((ahora - f.lastRunAt) / MS_DIA) * 10) / 10;
      return {
        key: f.key,
        etiqueta: m.etiqueta,
        queEs: m.queEs,
        cadencia: m.cadencia,
        lastRunAt: f.lastRunAt,
        lastStatus: f.lastStatus,
        message: f.message ?? null,
        rowsProcessed: f.rowsProcessed ?? null,
        diasDesde,
        // Una carga única no envejece: medirla contra el reloj dejaría el aviso
        // encendido para siempre y lo volvería invisible.
        atrasado: m.cadencia === "semanal" && diasDesde > DIAS_PARA_ATRASO,
      };
    })
    // Los periódicos primero: son los únicos que pueden estar mal hoy.
    .sort(
      (a, b) =>
        Number(b.cadencia === "semanal") - Number(a.cadencia === "semanal") ||
        b.lastRunAt - a.lastRunAt,
    );

  const periodicos = procesos.filter((p) => p.cadencia === "semanal");

  return {
    procesos,
    ultimaActualizacion:
      periodicos.length > 0
        ? Math.max(...periodicos.map((p) => p.lastRunAt))
        : null,
    hayError: procesos.some((p) => p.lastStatus === "error"),
    hayAtraso: procesos.some((p) => p.atrasado),
    sinDeclarar,
    diasParaAtraso: DIAS_PARA_ATRASO,
  };
}

export const estadoDatos = internalQuery({
  args: {},
  returns: estadoDatosReturns,
  handler: async (ctx) => estadoDatosImpl(ctx),
});
