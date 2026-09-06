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

/**
 * **De qué habla el aviso** — el eje que ordena la pantalla desde A141.
 *
 * Medir el reparto real en producción cambió el diseño. La intuición era
 * separar por época (viejo/nuevo), pero los números dicen otra cosa: de los
 * **2.165 sin resolver, 2.118 (97,8%) hablan de los contactos que sincroniza
 * Airtable** — la misma persona escribiendo varias veces, gente sin teléfono de
 * Costa Rica, fichas sin identificador. Eso no es historia: **crece todos los
 * lunes** con el sync, así que un corte por fecha no lo habría tocado.
 *
 * Y no describen la operación de SmartCheck: describen una herramienta que
 * **se está retirando** (A35). Por eso el eje es el origen y no el calendario.
 *
 *  - `sistema` — lo que produce el panel hoy. **Es lo que la pantalla debe
 *    medir**, y lo único que crece por algo que pase en el negocio.
 *  - `airtable` — hechos del CRM de contactos. Se van con Airtable.
 *  - `migracion` — el CRM viejo y la contabilidad anterior. **Conjunto
 *    cerrado**: no puede crecer.
 */
export type Origen = "sistema" | "airtable" | "migracion";

type Entrada = {
  clase: Clase;
  origen: Origen;
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
    origen: "sistema",
    titulo: "Un mes no cuadra con la captura automática",
    queEs:
      "Desde que el cobro se registra solo, lo cobrado según las revisiones de un mes debería coincidir con lo que entró a Finanzas. En este mes no coincide.",
    queHacer:
      "Revisar el mes en el tablero de conciliación: acá sí hay algo que mirar, porque el ingreso ya no se escribe a mano. El mes en curso no se marca nunca — la revisión se cuenta cuando se hace y el ingreso cuando se entrega el informe, así que su diferencia es normal.",
  },
  /**
   * Los meses de la época en que el ingreso se anotaba a mano — **A121**.
   *
   * Es el mismo detector que `reconciliation_gap`, separado **por la época del
   * mes**, no por su tamaño. Antes de la captura automática el ingreso se
   * tecleaba en la hoja y la diferencia contra las revisiones es historia
   * contable de Esteban: nadie va a reconciliar setiembre de 2025, y diez
   * avisos permanentes en «pide acción» —con cero resueltos, mes tras mes—
   * enseñan a ignorar la pantalla entera, que es justo lo que este tablero
   * existe para evitar.
   *
   * **No se ocultan ni se borran**: siguen listados, con su monto y su mes. Lo
   * que cambia es que dejan de pedir una acción que no existe.
   *
   * Y el corte no es arbitrario: desde que la captura automática arrancó, la
   * diferencia cayó a **2,2%** y **ningún mes volvió a marcarse**. O sea que un
   * gap en un mes automático **sí** significa algo roto hoy — y ahora se ve
   * solo, en vez de perderse entre diez que nadie va a tocar.
   */
  reconciliation_gap_manual: {
    clase: "informativo",
    origen: "migracion",
    titulo: "Un mes viejo no cuadra (ingreso anotado a mano)",
    queEs:
      "Antes de que el cobro se capturara solo, el ingreso se escribía en la hoja. Lo cobrado según las revisiones de esos meses no siempre coincide con lo que quedó anotado.",
    queHacer:
      "Nada, salvo que se quiera auditar un mes concreto. Son meses cerrados de la contabilidad anterior; el panel los muestra para que la diferencia no desaparezca, no porque haya algo que arreglar.",
  },
  malformed_row: {
    clase: "accion",
    origen: "migracion",
    titulo: "Una fila del sistema viejo quedó fuera",
    queEs: "Una revisión del CRM anterior sin fecha ni nombre; no se pudo importar.",
    queHacer: "Si el monto importa, recuperarla a mano desde la hoja original.",
  },
  lead_dup: {
    clase: "esperado",
    origen: "airtable",
    titulo: "La misma persona escribió más de una vez",
    queEs:
      "Airtable trae la misma persona en varias fichas. Se marcan para poder contarlas bien, pero no se fusionan.",
    queHacer:
      "Nada. Fusionarlas borraría historial de conversación, así que la decisión fue marcarlas y dejarlas.",
  },
  anomalous_phone: {
    clase: "informativo",
    origen: "airtable",
    titulo: "Contactos sin un teléfono de Costa Rica",
    queEs:
      "Escribieron por Instagram o Messenger (donde no hay teléfono) o desde un número internacional.",
    queHacer:
      "Nada. Es lo normal cuando el contacto llega por redes; se registra para saber cuántos son.",
  },
  lead_no_key: {
    clase: "informativo",
    origen: "airtable",
    titulo: "Fichas sin forma de identificar a la persona",
    queEs: "No tienen ni teléfono ni identificador de chat.",
    queHacer:
      /* Sin el «31»: el catálogo es texto fijo y el conteo se mueve con cada
         sync, así que una cifra escrita acá envejece sola y contradice al
         número que la propia fila muestra al lado (A145). */
      "Nada de nuestro lado. Si querés depurar Airtable, son las fichas que se listan acá.",
  },
  ambiguous_match: {
    clase: "informativo",
    origen: "sistema",
    titulo: "Dos contactos con el mismo teléfono para una revisión",
    queEs:
      "Al enlazar una revisión con su contacto había más de un candidato. Ya se resolvió por vehículo y fecha.",
    queHacer: "Nada. Queda anotado para poder auditar cómo se decidió.",
  },
  viatico_review: {
    clase: "informativo",
    origen: "migracion",
    titulo: "Taxonomía de viáticos revisada",
    queEs: "Movimientos del histórico que había que revisar por su categoría.",
    queHacer: "Nada: ya se revisaron y corrigieron.",
  },
  currency_ambiguous: {
    clase: "informativo",
    origen: "migracion",
    titulo: "Montos del sistema viejo en moneda ambigua",
    queEs: "No se sabía si el monto estaba en colones o en dólares.",
    queHacer: "Nada: se resolvieron con las respuestas de Esteban.",
  },
  zero_or_missing_amount: {
    clase: "informativo",
    origen: "migracion",
    titulo: "Revisiones viejas sin monto",
    queEs: "Filas del CRM anterior a las que no se les anotó el cobro.",
    queHacer: "Nada: ya se completaron o se descartaron.",
  },
  missing_date: {
    clase: "informativo",
    origen: "migracion",
    titulo: "Revisiones viejas sin fecha",
    queEs: "Filas del CRM anterior sin fecha de revisión.",
    queHacer: "Nada: ya se completaron.",
  },
  outlier_amount: {
    clase: "informativo",
    origen: "migracion",
    titulo: "Un monto muy fuera de rango",
    queEs: "Una revisión con un cobro muy distinto al resto.",
    queHacer: "Nada: se verificó y era correcto.",
  },
};

/** Para un tipo que nadie clasificó: pide acción, y se dice que falta clasificarlo. */
const SIN_CATALOGAR: Entrada = {
  clase: "accion",
  /* Sin catalogar va a `sistema`: es donde se mira. Mandarlo a un cajón que la
     pantalla esconde por defecto sería esconder justo lo que nadie revisó. */
  origen: "sistema",
  titulo: "Tipo de aviso sin clasificar",
  queEs: "Apareció un tipo de aviso que todavía no describimos.",
  queHacer: "Avisarnos: hay que decidir si pide acción o es esperado.",
};

const tipoRow = v.object({
  issueType: v.string(),
  clase: v.string(),
  /** `sistema` | `airtable` | `migracion` — de qué habla el aviso (A141). */
  origen: v.string(),
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
  /**
   * Los mismos avisos repartidos por **de qué hablan** (A141). Es el eje que
   * contesta la pregunta de Esteban —«¿esto mide mi sistema?»— y el que decide
   * qué se muestra por defecto.
   */
  porOrigen: v.object({
    sistema: v.number(),
    airtable: v.number(),
    migracion: v.number(),
  }),
  tipos: v.array(tipoRow),
  /** Tipos que aparecieron y no están en el catálogo. Vacío es lo esperado. */
  sinCatalogar: v.array(v.string()),
  cobertura: v.array(coberturaRow),
});

const pct = (x: number, d: number) => (d > 0 ? Math.round((x / d) * 1000) / 10 : 0);

/**
 * Cómputo puro (recibe `ctx`), compartido por la internal y el wrapper público
 * — en Convex una `query` no puede llamar a otra (A41).
 */
/**
 * **El detalle del aviso, en las palabras del panel — A156.**
 *
 * `bi_quality_issues.detail` es la representación interna del aviso, y así tiene
 * que quedarse: hay código que la **parsea** —`motivoTelefono` en `bi/leads.ts`
 * saca de ahí por qué un teléfono no sirve— y otros la leen para auditar. Pero
 * la pantalla de Calidad la pintaba **tal cual**, así que el dueño del negocio
 * se encontraba con:
 *
 *     gap 2026-07: finance=₡4546000 vs inspecciones=₡4937141 → Δ₡-391141 (-8.6%)
 *
 * Tres cosas mal a la vez: vocabulario de desarrollador (`gap`, `finance=`,
 * `phone8`, `Δ`), montos sin separador de miles donde todo el panel escribe
 * `₡4.546.000`, y el decimal con punto donde el resto usa coma. Es la pantalla
 * que se abre **cuando algo huele raro**, o sea la peor para encontrar sintaxis
 * ajena.
 *
 * Se traduce acá y no en el origen porque `calidadImpl` existe para alimentar
 * una pantalla; el dato guardado no cambia.
 */
function enCristiano(detalle: string): string {
  return detalle
    .replace(/^gap (\d{4})-(\d{2}):/, (_m, a, mm) => `${MESES[Number(mm) - 1]} de ${a}:`)
    .replace(/\bfinance=/g, "la contabilidad dice ")
    .replace(/\binspecciones=/g, "las revisiones suman ")
    .replace(/→ Δ/g, "· diferencia de ")
    .replace(/\bphone8 /g, "teléfono ")
    .replace(/^tel no normalizable: '(.*)'$/, (_m, v) =>
      v ? `el teléfono «${v}» no se puede leer como número de 8 dígitos`
        : "el contacto no trae teléfono")
    .replace(/no normalizable a (\d+) díg/g, "no se pudo leer como 8 dígitos ($1)")
    .replace(/sin teléfono ni manychatId → dedupKey sintética/g,
      "sin teléfono ni identificador de ManyChat: no hay con qué reconocerlo")
    .replace(/\bmanychatId\b/g, "identificador de ManyChat")
    .replace(/\bPSID\b/g, "identificador de Messenger")
    // «1 revisiones» se lee como un descuido. El número va pegado al sustantivo.
    .replace(/(\d+) inspección\(es\)/g, (_m, n) =>
      `${n} ${n === "1" ? "revisión" : "revisiones"}`)
    .replace(/(\d+) lead\(s\)/g, (_m, n) =>
      `${n} ${n === "1" ? "contacto" : "contactos"}`)
    .replace(/desambiguado por vehículo\/ventana/g,
      "se decidió por la marca del carro y las fechas")
    .replace(/\bmonto='(\d+)'/g, (_m, n) => `monto ₡${miles(n)}`)
    // Montos sin separador: ₡4546000 → ₡4.546.000. Va después de los reemplazos
    // de palabras para no tocar lo que ya venía formateado.
    .replace(/₡(-?)(\d{4,})/g, (_m, signo, n) => `${signo ? "−" : ""}₡${miles(n)}`)
    // Decimal con punto → coma, solo dentro de porcentajes.
    .replace(/\((-?)(\d+)\.(\d+)%\)/g, (_m, signo, ent, dec) =>
      `(${signo ? "−" : ""}${ent},${dec}%)`);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
] as const;

/** Puntos de miles, como el resto del panel. */
function miles(n: string): string {
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}


export async function calidadImpl(ctx: QueryCtx) {
  /* --- Avisos, agrupados por tipo ---------------------------------------- */
  type Acum = { sinResolver: number; resueltos: number; ejemplos: string[] };
  const porTipo = new Map<string, Acum>();

  /**
   * Primer mes con captura automática del cobro, para separar los gaps viejos
   * de los que importan hoy (**A121**).
   *
   * Se deriva del dato —el primer `finance_entries` cuyo `source` es
   * `inspection`— y no de una constante escrita: el día que la automatización
   * se apague o se adelante, el corte se mueve solo. Si todavía no hay ninguno,
   * queda `null` y **nada se reclasifica**: sin captura automática no hay «época
   * nueva» contra la cual comparar.
   */
  let primerMesAuto: string | null = null;
  for (const r of await ctx.db.query("finance_entries").collect()) {
    if (r.isDeleted || r.source !== "inspection") continue;
    if (primerMesAuto === null || r.yearMonth < primerMesAuto) {
      primerMesAuto = r.yearMonth;
    }
  }

  /**
   * El tipo con el que se cuenta un aviso, que no siempre es el guardado.
   *
   * `entityRef` de un `reconciliation_gap` es su mes (`"2026-07"`), así que la
   * separación se hace **al leer** y no reescribiendo `bi_quality_issues`: no
   * hay migración, no hay que correr nada contra producción, y el día que el
   * corte cambie el tablero se reacomoda solo.
   */
  const tipoEfectivo = (i: { issueType: string; entityRef?: string }): string => {
    if (i.issueType !== "reconciliation_gap") return i.issueType;
    if (primerMesAuto === null || !i.entityRef) return i.issueType;
    return i.entityRef < primerMesAuto
      ? "reconciliation_gap_manual"
      : "reconciliation_gap";
  };

  for (const i of await ctx.db.query("bi_quality_issues").collect()) {
    const tipo = tipoEfectivo(i);
    const a = porTipo.get(tipo) ?? { sinResolver: 0, resueltos: 0, ejemplos: [] };
    if (i.resolved) a.resueltos++;
    else a.sinResolver++;
    if (!i.resolved && a.ejemplos.length < 3 && i.detail)
      a.ejemplos.push(enCristiano(i.detail));
    porTipo.set(tipo, a);
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
        origen: e.origen,
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
  const porOrigen = { sistema: 0, airtable: 0, migracion: 0 };
  for (const t of tipos) {
    porClase[t.clase as Clase] += t.sinResolver;
    porOrigen[t.origen as Origen] += t.sinResolver;
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
    porOrigen,
    tipos,
    sinCatalogar,
    cobertura,
    /* La `nota` que viajaba acá no la pintaba ningún JSX — A151. Su contenido
       —por qué el catálogo clasifica por clase y no por severidad— vive en el
       docblock del catálogo, que es donde se busca. */
  };
}

export const calidad = internalQuery({
  args: {},
  returns: calidadReturns,
  handler: async (ctx) => calidadImpl(ctx),
});
