/**
 * Desglose de la categoría «Otros» en grupos con nombre (A61 · A83).
 *
 * El problema: `otros` se lleva casi un tercio del gasto y ahí adentro conviven
 * el contador, los celulares, las suscripciones, el equipo y los viáticos del
 * técnico. En el tablero, un tercio de la plata aparece en una bolsa sin nombre
 * y no sirve para decidir nada.
 *
 * Esteban confirmó los seis grupos el 19-ago (B30) y que **JRC es una empresa
 * tributaria**, así que va con el contador e Incorporate.
 *
 * ---
 *
 * **De dónde sale el proveedor.** La primera versión de esto clasificaba leyendo
 * `note`, y estaba mal: las notas de la migración son cadenas de procedencia
 * (`gasto_fijo|raw=$ 800,00|unmapped`) que **no traen el nombre del proveedor**.
 * El 91,8% caía sin clasificar.
 *
 * El proveedor sí sobrevivió, pero en `externalKey`, que la migración armó como
 * `sheet:<pestaña>:<ETIQUETA>:<n>` — y esa etiqueta es el renglón de la hoja de
 * Esteban: `INCORPORATE`, `JRC`, `SAFETY CULTURE`, `CELULAR KOLBI`. Es **dato
 * estructurado**, no prosa, que es exactamente la lección de **A64**: cuando
 * existe un campo con estructura, se usa ese y no el texto libre.
 *
 * Las tres decisiones que lo hacen seguro:
 *
 * 1. **Mapeo explícito por etiqueta**, no heurística sobre texto libre. Una
 *    lista de etiquetas → grupo, visible y editable en un solo lugar.
 * 2. **«Sin clasificar» es un grupo de primera clase**, no un descarte. Devuelve
 *    los montos Y las notas, así que un proveedor nuevo **aparece** en vez de
 *    caer callado en el grupo equivocado. Es lo contrario de A64: acá el hueco
 *    es ruidoso por construcción.
 * 3. **Se calcula al leer, no se guarda.** El mapeo va a cambiar cada vez que
 *    aparezca un proveedor nuevo; si el grupo estuviera guardado en la fila,
 *    cada cambio obligaría a una migración y las filas viejas quedarían con
 *    grupos viejos. Además **no toca ni un colón**: es la misma plata, mejor
 *    ordenada, así que reagrupar nunca puede alterar la utilidad.
 */
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";

/** Los seis grupos que Esteban aprobó, más el que se explica solo. */
export const GRUPOS = [
  "servicios_profesionales",
  "software",
  "viaticos_tecnico",
  "equipo",
  "telefonia",
  "sin_clasificar",
] as const;

/**
 * Las categorías de finanzas que entran a este desglose (**B36 · consulta 7**).
 *
 * Empezó cubriendo solo `otros`. Esteban pidió que el mantenimiento del chatbot
 * y el del panel fueran con los demás servicios profesionales —«al final igual
 * son servicios profesionales»—, y esos viven en `mantenimiento`. Ampliar el
 * alcance es un cambio de **lectura**, no de datos: no se movió ni una fila.
 *
 * Se exporta y se devuelve en la respuesta a propósito: el total de esta tarjeta
 * ya no es el de la barra «Otros» del gráfico de categorías, y esa diferencia
 * tiene que poder explicarse sin abrir el código.
 */
export const CATEGORIAS_CUBIERTAS = ["otros", "mantenimiento"] as const;

export type Grupo = (typeof GRUPOS)[number];

/**
 * Etiquetas → grupo. **Este es el único lugar donde se decide.**
 *
 * Se compara en minúsculas y sin tildes. El orden importa: gana el primero que
 * calce, así que lo específico va antes que lo general.
 */
const MAPEO: Array<{ patrones: string[]; grupo: Grupo }> = [
  {
    grupo: "servicios_profesionales",
    patrones: ["incorporate", "jrc", "contador", "contabilidad", "abogad", "legal"],
  },
  {
    grupo: "software",
    patrones: [
      // Los nombres van como aparecen en la hoja: «OPEN AI» lleva espacio y
      // «openai» no calzaba. Se descubrió porque quedaron sin clasificar.
      "safety culture", "safetyculture", "open ai", "openai", "gpt",
      "manychat", "airtable", "contabo", "vercel", "convex", "clerk",
      "servidor chatbot", "base datos app", "ig verified", "captions",
      "suscripcion", "software", "licencia", "dominio", "hosting",
      "canva", "google workspace",
    ],
  },
  {
    grupo: "telefonia",
    patrones: ["kolbi", "claro", "movistar", "liberty", "telefon", "celular", "recarga"],
  },
  {
    // Antes eran su propio grupo («desarrollo del panel»). Esteban los mandó con
    // los demás servicios profesionales. Se conserva la POSICIÓN original en la
    // lista y solo cambia el destino: mover la entrada más arriba haría que
    // «dashboard» le ganara a los patrones de software, y el orden es la regla.
    grupo: "servicios_profesionales",
    patrones: [
      "dashboard", "panel", "desarrollo", "costa coders", "bi ",
      // La frase completa y no «chatbot» a secas. Hoy da lo mismo —esta entrada
      // va DESPUÉS de software, así que `AIRTABLE (BASE DATOS CHATBOT)` calza
      // con `airtable` antes de llegar acá—, pero eso lo sostiene la posición en
      // la lista, no el patrón. La frase hace que siga siendo correcto aunque
      // alguien mueva la entrada. Hay una prueba que fija ese orden.
      "mantenimiento chatbot",
    ],
  },
  {
    grupo: "equipo",
    patrones: [
      "equipo", "herramienta", "scanner", "escaner", "laptop", "computadora",
      "tablet", "impresora", "camara", "bateria", "cargador",
    ],
  },
  {
    grupo: "viaticos_tecnico",
    patrones: ["viatico", "viático", "sergio", "tecnico", "técnico"],
  },
];

/**
 * La etiqueta de la hoja, sacada de `externalKey`.
 *
 * Formato: `sheet:<pestaña>:<etiqueta>:<n>`. La etiqueta puede traer `:` adentro
 * (raro pero posible), así que se toma todo lo que va entre la segunda y la
 * última parte en vez de partir a ciegas por el separador.
 *
 * Devuelve `undefined` para los movimientos que no vienen de la hoja —captura
 * manual de Esteban, o los que genera el sistema al entregar un reporte—, que
 * caen al texto de la nota.
 */
export function etiquetaDeExternalKey(externalKey: string | undefined): string | undefined {
  if (!externalKey?.startsWith("sheet:")) return undefined;
  const partes = externalKey.split(":");
  if (partes.length < 4) return undefined;
  const etiqueta = partes.slice(2, -1).join(":").trim();
  return etiqueta.length > 0 ? etiqueta : undefined;
}

/**
 * Minúsculas y sin tildes: «Viático» y «viatico» son la misma palabra.
 *
 * Exportada porque el guard de la planilla (B34) compara las mismas etiquetas de
 * hoja que este módulo, y duplicar la normalización sería la vía más corta a que
 * un día «PROVISIÓN» con tilde calce acá y no allá.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * La etiqueta como se muestra: sin el paréntesis aclaratorio.
 *
 * En la hoja escribió `OPEN AI` y en la app `OPEN AI (CHATBOT)`; lo mismo con
 * Airtable, Contabo, Captions y ManyChat. Es **el mismo proveedor escrito dos
 * veces**, y listarlo dos veces en la tarjeta sería ruido disfrazado de detalle.
 *
 * Se quita solo el paréntesis, nada más. `CELULAR KOLBI` y `CELULAR KOLBI
 * TECNICO` **no** se juntan, y está bien: son dos líneas distintas.
 */
export function etiquetaVisible(etiqueta: string): string {
  return etiqueta.replace(/\s*\([^)]*\)/g, "").trim() || etiqueta.trim();
}

/**
 * A qué grupo pertenece un movimiento.
 *
 * Exportada y pura a propósito: es la única regla, y se prueba directo sin
 * montar una base de datos.
 */
export function clasificar(
  { externalKey, note, isViatico }:
    { externalKey?: string; note?: string; isViatico: boolean },
): Grupo {
  // Un movimiento marcado como viático es viático, diga lo que diga la etiqueta.
  // El dato estructurado le gana al texto libre siempre que exista.
  if (isViatico) return "viaticos_tecnico";

  // La etiqueta de la hoja primero; la nota solo como respaldo para lo que no
  // vino de la hoja.
  const fuente = etiquetaDeExternalKey(externalKey) ?? note ?? "";
  const n = normalizar(fuente);
  if (!n.trim()) return "sin_clasificar";

  for (const { patrones, grupo } of MAPEO) {
    for (const p of patrones) {
      if (n.includes(normalizar(p))) return grupo;
    }
  }
  return "sin_clasificar";
}

const etiquetaRow = v.object({
  etiqueta: v.string(),
  rows: v.number(),
  amountCRC: v.number(),
});

const grupoRow = v.object({
  grupo: v.string(),
  rows: v.number(),
  amountCRC: v.number(),
  /** Porcentaje sobre el total del desglose. */
  pct: v.number(),
  /**
   * Los proveedores del grupo, de mayor a menor. Es lo que pidió Esteban: «a
   * cada cosa le ponemos una etiqueta». Sin esto, «servicios profesionales»
   * dice ₡6,7 M y no dice de quién.
   */
  etiquetas: v.array(etiquetaRow),
});

const breakdownReturns = v.object({
  /** Categorías de finanzas que entran acá. La tarjeta las nombra en pantalla. */
  categorias: v.array(v.string()),
  /** Total del desglose — debe cuadrar con la suma de los grupos. */
  totalCRC: v.number(),
  totalRows: v.number(),
  grupos: v.array(grupoRow),
  /**
   * Las etiquetas que no calzaron con ninguna regla, con su monto y cuántas
   * veces aparecen. **Esta lista es el mantenimiento del mapeo**: si crece, es
   * que entró un proveedor nuevo y hay que decidir dónde va.
   */
  sinClasificar: v.array(
    v.object({
      etiqueta: v.string(),
      rows: v.number(),
      amountCRC: v.number(),
    }),
  ),
});

export async function expenseBreakdownImpl(
  ctx: QueryCtx,
  { fromMs, toMs }: { fromMs?: number; toMs?: number },
) {
  const porGrupo = new Map<string, { rows: number; amountCRC: number }>();
  /** Proveedores dentro de cada grupo: grupo → etiqueta visible → totales. */
  const porEtiqueta = new Map<string, Map<string, { rows: number; amountCRC: number }>>();
  const porNota = new Map<string, { rows: number; amountCRC: number }>();
  let totalCRC = 0;
  let totalRows = 0;

  for (const r of await ctx.db.query("finance_entries").collect()) {
    if (r.isDeleted) continue;
    if (r.kind !== "expense") continue;
    if (!(CATEGORIAS_CUBIERTAS as readonly string[]).includes(r.category)) continue;
    if (fromMs != null && r.date < fromMs) continue;
    if (toMs != null && r.date >= toMs) continue;

    totalCRC += r.amountCRC;
    totalRows++;

    const grupo = clasificar(r);
    const g = porGrupo.get(grupo) ?? { rows: 0, amountCRC: 0 };
    g.rows++;
    g.amountCRC += r.amountCRC;
    porGrupo.set(grupo, g);

    // La etiqueta cruda primero; la nota como respaldo para la captura manual.
    const cruda =
      etiquetaDeExternalKey(r.externalKey) ??
      ((r.note ?? "").trim() || "(sin etiqueta)");
    const visible = etiquetaVisible(cruda);
    const dentro = porEtiqueta.get(grupo) ?? new Map();
    const e = dentro.get(visible) ?? { rows: 0, amountCRC: 0 };
    e.rows++;
    e.amountCRC += r.amountCRC;
    dentro.set(visible, e);
    porEtiqueta.set(grupo, dentro);

    if (grupo === "sin_clasificar") {
      // Se agrupa por ETIQUETA, que es lo accionable: dice qué proveedor falta
      // mapear. La nota cruda no le sirve a nadie para decidir.
      const clave =
        etiquetaDeExternalKey(r.externalKey) ??
        ((r.note ?? "").trim() || "(sin etiqueta)");
      const n = porNota.get(clave) ?? { rows: 0, amountCRC: 0 };
      n.rows++;
      n.amountCRC += r.amountCRC;
      porNota.set(clave, n);
    }
  }

  const grupos = [...porGrupo.entries()]
    .map(([grupo, v]) => ({
      grupo,
      rows: v.rows,
      amountCRC: v.amountCRC,
      // Redondeado a una decimal; con 0 movimientos no se divide entre cero.
      pct: totalCRC > 0 ? Math.round((v.amountCRC / totalCRC) * 1000) / 10 : 0,
      etiquetas: [...(porEtiqueta.get(grupo) ?? new Map()).entries()]
        .map(([etiqueta, e]) => ({ etiqueta, rows: e.rows, amountCRC: e.amountCRC }))
        .sort((a, b) => b.amountCRC - a.amountCRC),
    }))
    .sort((a, b) => b.amountCRC - a.amountCRC);

  const sinClasificar = [...porNota.entries()]
    .map(([etiqueta, v]) => ({ etiqueta, rows: v.rows, amountCRC: v.amountCRC }))
    .sort((a, b) => b.amountCRC - a.amountCRC);

  return {
    categorias: [...CATEGORIAS_CUBIERTAS],
    totalCRC,
    totalRows,
    grupos,
    sinClasificar,
  };
}

export const expenseBreakdown = internalQuery({
  args: { fromMs: v.optional(v.number()), toMs: v.optional(v.number()) },
  returns: breakdownReturns,
  handler: async (ctx, args) => expenseBreakdownImpl(ctx, args),
});

export { breakdownReturns };
