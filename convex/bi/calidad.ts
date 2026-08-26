/**
 * Calidad de los datos (F3 · tablero 4 de 5).
 *
 * **El problema que resuelve es de lectura, no de datos.** En producción hay
 * **2.158 issues** registrados. Puesto así, el tablero diría que el sistema está
 * en llamas. No lo está: **1.869 de esos son `lead_dup`**, que se marcan a
 * propósito y **no se fusionan** (A26) — Airtable trae la misma persona varias
 * veces y esa duplicación es un hecho del dato, no un error nuestro. Mostrar los
 * 2.158 juntos entrena a ignorar el tablero entero, que es la peor forma de
 * perder los pocos que sí importan.
 *
 * Así que cada tipo se declara en un **catálogo explícito** con tres cosas: en
 * qué clase cae, qué significa en castellano, y qué se hace con él.
 *
 * ---
 *
 * **Un tipo que no esté en el catálogo cae en «pide acción», no en «ruido».** Es
 * la lección de A64 aplicada otra vez: el hueco tiene que ser ruidoso. Si mañana
 * aparece un `issueType` nuevo y lo clasificáramos por defecto como esperado, se
 * escondería solo — y justo los tipos nuevos son los que nadie ha mirado todavía.
 * Además se devuelven aparte en `sinCatalogar` para que se vea que falta
 * clasificarlos.
 */
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { buildInspectionsAll } from "./metrics";

/** En qué clase cae un tipo de issue. */
export type Clase = "accion" | "informativo" | "esperado";

type Entrada = {
  clase: Clase;
  titulo: string;
  /** Qué es, en castellano y sin jerga. */
  queEs: string;
  /** Qué se hace con esto. Para los que no piden nada, por qué no piden nada. */
  queHacer: string;
};

/**
 * El catálogo. **Este es el único lugar donde se decide** si algo pide acción.
 *
 * Cambiar una clase acá cambia el tablero entero, y por eso está escrito y no
 * derivado de la severidad: `anomalous_phone` es `info` y `ambiguous_match` es
 * `warn`, pero los dos son igual de poco accionables. La severidad la puso quien
 * escribió el detector; la clase la decide para qué sirve el tablero.
 */
export const CATALOGO: Record<string, Entrada> = {
  reconciliation_gap: {
    clase: "accion",
    titulo: "Un mes no cuadra",
    queEs:
      "Lo cobrado según las revisiones de ese mes no coincide con lo que entró a Finanzas.",
    queHacer:
      "Revisar el mes en el tablero de conciliación. El mes en curso siempre muestra diferencia y no es un problema: la revisión se cuenta cuando se hace y el ingreso cuando se entrega el informe.",
  },
  malformed_row: {
    clase: "accion",
    titulo: "Una fila del sistema viejo quedó fuera",
    queEs: "Una revisión del CRM anterior sin fecha ni nombre; no se pudo importar.",
    queHacer: "Si el monto importa, recuperarla a mano desde la hoja original.",
  },
  lead_dup: {
    clase: "esperado",
    titulo: "La misma persona escribió más de una vez",
    queEs:
      "Airtable trae la misma persona en varias fichas. Se marcan para poder contarlas bien, pero no se fusionan.",
    queHacer:
      "Nada. Fusionarlas borraría historial de conversación, así que la decisión fue marcarlas y dejarlas.",
  },
  anomalous_phone: {
    clase: "informativo",
    titulo: "Contactos sin un teléfono de Costa Rica",
    queEs:
      "Escribieron por Instagram o Messenger (donde no hay teléfono) o desde un número internacional.",
    queHacer:
      "Nada. Es lo normal cuando el contacto llega por redes; se registra para saber cuántos son.",
  },
  lead_no_key: {
    clase: "informativo",
    titulo: "Fichas sin forma de identificar a la persona",
    queEs: "No tienen ni teléfono ni identificador de chat.",
    queHacer:
      "Nada de nuestro lado. Si querés depurar Airtable, son estas 31 fichas.",
  },
  ambiguous_match: {
    clase: "informativo",
    titulo: "Dos contactos con el mismo teléfono para una revisión",
    queEs:
      "Al enlazar una revisión con su contacto había más de un candidato. Ya se resolvió por vehículo y fecha.",
    queHacer: "Nada. Queda anotado para poder auditar cómo se decidió.",
  },
  viatico_review: {
    clase: "informativo",
    titulo: "Taxonomía de viáticos revisada",
    queEs: "Movimientos del histórico que había que revisar por su categoría.",
    queHacer: "Nada: ya se revisaron y corrigieron.",
  },
  currency_ambiguous: {
    clase: "informativo",
    titulo: "Montos del sistema viejo en moneda ambigua",
    queEs: "No se sabía si el monto estaba en colones o en dólares.",
    queHacer: "Nada: se resolvieron con las respuestas de Esteban.",
  },
  zero_or_missing_amount: {
    clase: "informativo",
    titulo: "Revisiones viejas sin monto",
    queEs: "Filas del CRM anterior a las que no se les anotó el cobro.",
    queHacer: "Nada: ya se completaron o se descartaron.",
  },
  missing_date: {
    clase: "informativo",
    titulo: "Revisiones viejas sin fecha",
    queEs: "Filas del CRM anterior sin fecha de revisión.",
    queHacer: "Nada: ya se completaron.",
  },
  outlier_amount: {
    clase: "informativo",
    titulo: "Un monto muy fuera de rango",
    queEs: "Una revisión con un cobro muy distinto al resto.",
    queHacer: "Nada: se verificó y era correcto.",
  },
};

/** Para un tipo que nadie clasificó: pide acción, y se dice que falta clasificarlo. */
const SIN_CATALOGAR: Entrada = {
  clase: "accion",
  titulo: "Tipo de aviso sin clasificar",
  queEs: "Apareció un tipo de aviso que todavía no describimos.",
  queHacer: "Avisarnos: hay que decidir si pide acción o es esperado.",
};

const tipoRow = v.object({
  issueType: v.string(),
  clase: v.string(),
  titulo: v.string(),
  queEs: v.string(),
  queHacer: v.string(),
  sinResolver: v.number(),
  resueltos: v.number(),
  /** Hasta tres ejemplos del detalle, para poder ir a mirar. */
  ejemplos: v.array(v.string()),
});

const coberturaRow = v.object({
  campo: v.string(),
  presentes: v.number(),
  total: v.number(),
  pct: v.number(),
  faltan: v.number(),
});

export const calidadReturns = v.object({
  totalIssues: v.number(),
  sinResolver: v.number(),
  resueltos: v.number(),
  /** Cuántos avisos SIN RESOLVER hay en cada clase. Es el titular del tablero. */
  porClase: v.object({
    accion: v.number(),
    informativo: v.number(),
    esperado: v.number(),
  }),
  tipos: v.array(tipoRow),
  /** Tipos que aparecieron y no están en el catálogo. Vacío es lo esperado. */
  sinCatalogar: v.array(v.string()),
  cobertura: v.array(coberturaRow),
  nota: v.string(),
});

const pct = (x: number, d: number) => (d > 0 ? Math.round((x / d) * 1000) / 10 : 0);

/**
 * Cómputo puro (recibe `ctx`), compartido por la internal y el wrapper público
 * — en Convex una `query` no puede llamar a otra (A41).
 */
export async function calidadImpl(ctx: QueryCtx) {
  /* --- Avisos, agrupados por tipo ---------------------------------------- */
  type Acum = { sinResolver: number; resueltos: number; ejemplos: string[] };
  const porTipo = new Map<string, Acum>();

  for (const i of await ctx.db.query("bi_quality_issues").collect()) {
    const a = porTipo.get(i.issueType) ?? { sinResolver: 0, resueltos: 0, ejemplos: [] };
    if (i.resolved) a.resueltos++;
    else a.sinResolver++;
    if (!i.resolved && a.ejemplos.length < 3 && i.detail) a.ejemplos.push(i.detail);
    porTipo.set(i.issueType, a);
  }

  const sinCatalogar: string[] = [];
  const tipos = [...porTipo.entries()]
    .map(([issueType, a]) => {
      const meta = CATALOGO[issueType];
      if (!meta) sinCatalogar.push(issueType);
      const e = meta ?? SIN_CATALOGAR;
      return {
        issueType,
        clase: e.clase,
        titulo: e.titulo,
        queEs: e.queEs,
        queHacer: e.queHacer,
        sinResolver: a.sinResolver,
        resueltos: a.resueltos,
        ejemplos: a.ejemplos,
      };
    })
    // Primero lo que pide acción, y dentro de cada clase lo más grande.
    .sort((x, y) => {
      const orden: Record<string, number> = { accion: 0, informativo: 1, esperado: 2 };
      return (
        (orden[x.clase] ?? 0) - (orden[y.clase] ?? 0) ||
        y.sinResolver - x.sinResolver
      );
    });

  const porClase = { accion: 0, informativo: 0, esperado: 0 };
  for (const t of tipos) {
    porClase[t.clase as Clase] += t.sinResolver;
  }

  /* --- Cobertura: qué tan completos están los datos ---------------------- */
  const leads = (await ctx.db.query("leads_contacts").collect()).filter(
    (l) => !l.isDeleted,
  );
  const revisiones = (await buildInspectionsAll(ctx)).all;

  const cobertura = [
    {
      campo: "Contactos con teléfono utilizable",
      presentes: leads.filter((l) => l.phoneValid).length,
      total: leads.length,
    },
    {
      campo: "Contactos con nombre",
      presentes: leads.filter((l) => !!l.name).length,
      total: leads.length,
    },
    {
      campo: "Contactos con identificador de chat",
      presentes: leads.filter((l) => !!l.manychatId).length,
      total: leads.length,
    },
    {
      campo: "Revisiones con canal anotado",
      presentes: revisiones.filter((r) => !!r.channel).length,
      total: revisiones.length,
    },
    {
      campo: "Revisiones con monto",
      presentes: revisiones.filter((r) => r.amountCRC !== undefined).length,
      total: revisiones.length,
    },
  ].map((c) => ({
    ...c,
    pct: pct(c.presentes, c.total),
    faltan: c.total - c.presentes,
  }));

  const totalIssues = tipos.reduce((a, t) => a + t.sinResolver + t.resueltos, 0);
  const sinResolver = tipos.reduce((a, t) => a + t.sinResolver, 0);

  return {
    totalIssues,
    sinResolver,
    resueltos: totalIssues - sinResolver,
    porClase,
    tipos,
    sinCatalogar,
    cobertura,
    nota:
      "Los avisos se clasifican por un catálogo escrito, no por su severidad: la severidad la puso quien programó el detector, la clase dice para qué sirve mirarlo. Un tipo que no esté en el catálogo cae en «pide acción» a propósito, para que no se esconda.",
  };
}

export const calidad = internalQuery({
  args: {},
  returns: calidadReturns,
  handler: async (ctx) => calidadImpl(ctx),
});
