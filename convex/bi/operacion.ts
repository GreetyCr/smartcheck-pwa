/**
 * Calidad **& operación** de las revisiones — **RF-07**, el de verdad.
 *
 * ## Por qué este archivo existe
 *
 * El 24-ago se entregó un tablero llamado «Calidad» que mide **calidad de los
 * datos** —duplicados de leads, avisos del BI— y se dio RF-07 por cerrado. La
 * auditoría A100 encontró que el requerimiento pide otra cosa: **hallazgos
 * frecuentes, condición del vehículo y SLA de respuesta**, sobre las revisiones.
 * Esto es eso, y es el único pendiente del plan que necesitaba cálculo desde
 * cero en vez de una pantalla sobre algo ya calculado.
 *
 * ## La trampa del checklist, y por qué no se resuelve acá
 *
 * En los ítems «sí/no» **«sí» no siempre es malo**: `fuga_aceite: sí` es un
 * hallazgo, pero `extintor: sí` es que el carro trae extintor. De los 44 ítems
 * sí/no del esquema, **18 son de los que se convierten en hallazgo cuando la
 * respuesta es NO** (`findingWhenNo`). Asumir una polaridad uniforme reportaría
 * «tiene gata» y «tiene llanta de repuesto» como los defectos más comunes de la
 * flota — exactamente al revés de la verdad.
 *
 * Esa regla **ya existe y ya está probada** en `lib/inspection-findings.ts`, y
 * es la misma que usan el PDF y el listado de secciones. Acá se reusa tal cual.
 * Escribir una segunda tabla de polaridad habría sido la forma más rápida de que
 * el tablero y el informe del cliente dijeran cosas distintas del mismo carro.
 *
 * ## Los dos huecos que se reportan en vez de taparse
 *
 * 1. **El SLA no se puede medir en todas.** Necesita fecha de inicio y fecha de
 *    entrega, y en producción **49 de las 142 revisiones entregadas no tienen
 *    fecha de inicio**. Se calcula sobre las que sí y **se dice cuántas quedaron
 *    fuera**: un promedio sobre el 65% presentado como si fuera sobre el 100% es
 *    peor que no tener el indicador.
 * 2. **Un ítem del formulario que no esté en el catálogo** sale en
 *    `itemsSinCatalogar` en vez de ignorarse. Es la regla A64: el hueco tiene
 *    que hacer ruido, nunca pasar por «ruido esperado».
 */
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import {
  dimensionesDeInspeccion,
  filterValidator,
  pasaFiltros,
  type FilterArgs,
} from "./metrics";
import { SECTIONS_CONFIG } from "@/lib/constants/sectionItems";
import { findingsByItemForSectionDoc } from "@/lib/inspection-findings";
import { yearMonth as ymFromMs } from "./lib/dates";

/** Cuántos ítems se listan en «lo que más sale». Más no se lee, menos no informa. */
export const TOP_HALLAZGOS = 12;

/**
 * Un ítem entra al ranking a partir de esta cantidad de evaluaciones.
 *
 * Sin un piso, un ítem evaluado **una vez** y con hallazgo esa vez encabeza la
 * lista con 100%. El umbral es bajo a propósito —hay 146 revisiones, no miles—
 * pero tiene que existir, y los que quedan fuera se cuentan para que el recorte
 * sea visible y no un silencio.
 */
export const MIN_EVALUACIONES = 10;

/** Etiquetas de la condición que anota el técnico (`biVehicleCondition`). */
export const CONDICION: Record<number, string> = {
  1: "Buen estado",
  2: "Estado regular",
  3: "Mal estado",
};

const HORA_MS = 3_600_000;

const itemRow = v.object({
  seccion: v.string(),
  seccionEtiqueta: v.string(),
  item: v.string(),
  itemEtiqueta: v.string(),
  /** Revisiones donde este ítem salió con hallazgo. */
  hallazgos: v.number(),
  /** Revisiones donde el ítem se evaluó (respuesta distinta de «no aplica»). */
  evaluados: v.number(),
  /** `hallazgos / evaluados`. El denominador es el honesto, no el total. */
  pct: v.number(),
});

export const operacionReturns = v.object({
  revisiones: v.object({
    total: v.number(),
    entregadas: v.number(),
    conChecklist: v.number(),
  }),

  condicion: v.object({
    niveles: v.array(
      v.object({
        nivel: v.number(),
        etiqueta: v.string(),
        rows: v.number(),
        pct: v.number(),
      }),
    ),
    sinDato: v.number(),
  }),

  hallazgos: v.object({
    /** Revisiones con al menos una sección llena. Es el denominador de todo. */
    evaluadas: v.number(),
    total: v.number(),
    promedioPorRevision: v.number(),
    /** Revisiones sin un solo hallazgo. */
    sinHallazgos: v.number(),
    porSeccion: v.array(
      v.object({
        seccion: v.string(),
        etiqueta: v.string(),
        hallazgos: v.number(),
        /** Revisiones con al menos un hallazgo en esta sección. */
        revisionesConAlguno: v.number(),
        revisionesEvaluadas: v.number(),
        pct: v.number(),
      }),
    ),
    top: v.array(itemRow),
    /** Ítems que no llegaron al piso de evaluaciones. Se cuentan, no se esconden. */
    fueraDelRanking: v.number(),
    minEvaluaciones: v.number(),
    /** Claves del formulario que NO están en el catálogo. Debe estar vacío. */
    itemsSinCatalogar: v.array(v.string()),
  }),

  sla: v.object({
    /** Revisiones entregadas con las dos fechas. Es la base del cálculo. */
    medibles: v.number(),
    entregadas: v.number(),
    /** Entregadas SIN fecha de inicio: el hueco, dicho con número. */
    sinFechaInicio: v.number(),
    /** Entregadas con fecha de entrega ANTERIOR al inicio. Dato imposible. */
    inconsistentes: v.number(),
    medianaHoras: v.number(),
    p90Horas: v.number(),
    maxHoras: v.number(),
    dentroDe24h: v.number(),
    dentroDe48h: v.number(),
    porMes: v.array(
      v.object({
        ym: v.string(),
        rows: v.number(),
        medianaHoras: v.number(),
      }),
    ),
    /** Entregadas sin fecha de entrega — no deberían existir. */
    sinFechaEntrega: v.number(),
  }),

  nota: v.string(),
});

export const operacion = internalQuery({
  args: { ...filterValidator },
  returns: operacionReturns,
  handler: async (ctx, args) => operacionImpl(ctx, args),
});

/** Mediana. Con lista vacía devuelve 0, no NaN. */
function mediana(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Percentil por el método del más cercano. Con lista vacía, 0. */
function percentil(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i];
}

const redondear = (n: number, dec = 1) => {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
};

const pct = (x: number, d: number) => (d > 0 ? redondear((x / d) * 100, 1) : 0);

/**
 * Cómputo plano que recibe `ctx` (A41: una `query` no puede `ctx.runQuery`, así
 * que la internal y el wrapper público comparten este helper).
 *
 * Lee las 18 tablas de sección enteras. Es aceptable **hoy**: son 146 revisiones
 * y ~1.900 documentos en total. Si la app llegara a decenas de miles habría que
 * materializar por revisión al guardar la sección, no al leer.
 */
export async function operacionImpl(ctx: QueryCtx, filtros: FilterArgs = {}) {
  /**
   * La barra global (RF-02) se aplica acá **con el mismo predicado y los mismos
   * normalizadores** que la vista unificada, no con una copia. Nótese que este
   * tablero solo ve revisiones de la app: el checklist y las fechas de entrega
   * no existen en el CRM viejo. Eso ya era cierto antes de la barra.
   */
  const todas = await ctx.db.query("inspections").collect();
  const inspecciones = todas.filter((r) =>
    pasaFiltros(dimensionesDeInspeccion(r), filtros),
  );
  const permitidas = new Set(inspecciones.map((r) => String(r._id)));
  const entregadas = inspecciones.filter((r) => r.reportDeliveredAt != null);

  /* ---------------------------- condición ---------------------------------- */
  const porCondicion = new Map<number, number>();
  let sinDato = 0;
  for (const r of inspecciones) {
    const c = r.biVehicleCondition;
    if (c == null) sinDato++;
    else porCondicion.set(c, (porCondicion.get(c) ?? 0) + 1);
  }
  const conCondicion = inspecciones.length - sinDato;
  const niveles = [1, 2, 3].map((nivel) => {
    const rows = porCondicion.get(nivel) ?? 0;
    return {
      nivel,
      etiqueta: CONDICION[nivel] ?? `Nivel ${nivel}`,
      rows,
      // Sobre las que SÍ tienen dato: incluir las que no lo tienen en el
      // denominador haría ver a todos los niveles más raros de lo que son.
      pct: pct(rows, conCondicion),
    };
  });

  /* ---------------------------- hallazgos ---------------------------------- */
  type Acum = { hallazgos: number; evaluados: number };
  const porItem = new Map<string, Acum>();
  const porSeccionAcum = new Map<
    string,
    { hallazgos: number; conAlguno: number; evaluadas: number }
  >();
  const hallazgosPorRevision = new Map<string, number>();
  const revisionesEvaluadas = new Set<string>();
  const sinCatalogar = new Set<string>();

  for (const cfg of SECTIONS_CONFIG) {
    const docs = await ctx.db.query(cfg.table).collect();
    for (const doc of docs) {
      const id = String((doc as { inspectionId: unknown }).inspectionId);
      // Una sección cuya revisión quedó fuera del filtro no aporta hallazgos.
      if (!permitidas.has(id)) continue;
      const r = findingsByItemForSectionDoc(
        cfg.table,
        doc as unknown as Record<string, unknown>,
      );
      for (const k of r.sinCatalogar) sinCatalogar.add(k);
      if (r.evaluados.length === 0) continue;

      revisionesEvaluadas.add(id);
      hallazgosPorRevision.set(
        id,
        (hallazgosPorRevision.get(id) ?? 0) + r.hallazgos.length,
      );

      const sec = porSeccionAcum.get(cfg.table) ?? {
        hallazgos: 0,
        conAlguno: 0,
        evaluadas: 0,
      };
      sec.evaluadas++;
      sec.hallazgos += r.hallazgos.length;
      if (r.hallazgos.length > 0) sec.conAlguno++;
      porSeccionAcum.set(cfg.table, sec);

      for (const key of r.evaluados) {
        const k = `${cfg.table}|${key}`;
        const a = porItem.get(k) ?? { hallazgos: 0, evaluados: 0 };
        a.evaluados++;
        porItem.set(k, a);
      }
      for (const key of r.hallazgos) {
        const k = `${cfg.table}|${key}`;
        const a = porItem.get(k) ?? { hallazgos: 0, evaluados: 0 };
        a.hallazgos++;
        porItem.set(k, a);
      }
    }
  }

  const etiquetaSeccion = (table: string) =>
    SECTIONS_CONFIG.find((s) => s.table === table)?.name ?? table;
  const etiquetaItem = (table: string, key: string) =>
    SECTIONS_CONFIG.find((s) => s.table === table)?.items.find(
      (i) => i.key === key,
    )?.label ?? key;

  const evaluadas = revisionesEvaluadas.size;
  const totalHallazgos = [...hallazgosPorRevision.values()].reduce(
    (s, n) => s + n,
    0,
  );
  const sinHallazgos = [...revisionesEvaluadas].filter(
    (id) => (hallazgosPorRevision.get(id) ?? 0) === 0,
  ).length;

  const porSeccion = [...porSeccionAcum.entries()]
    .map(([seccion, a]) => ({
      seccion,
      etiqueta: etiquetaSeccion(seccion),
      hallazgos: a.hallazgos,
      revisionesConAlguno: a.conAlguno,
      revisionesEvaluadas: a.evaluadas,
      pct: pct(a.conAlguno, a.evaluadas),
    }))
    .sort((x, y) => y.pct - x.pct || y.hallazgos - x.hallazgos);

  const candidatos = [...porItem.entries()]
    .map(([k, a]) => {
      const [seccion, item] = k.split("|");
      return {
        seccion,
        seccionEtiqueta: etiquetaSeccion(seccion),
        item,
        itemEtiqueta: etiquetaItem(seccion, item),
        hallazgos: a.hallazgos,
        evaluados: a.evaluados,
        pct: pct(a.hallazgos, a.evaluados),
      };
    })
    .filter((r) => r.hallazgos > 0);

  const elegibles = candidatos.filter((r) => r.evaluados >= MIN_EVALUACIONES);
  const top = [...elegibles]
    .sort((x, y) => y.pct - x.pct || y.hallazgos - x.hallazgos)
    .slice(0, TOP_HALLAZGOS);

  /* ------------------------------- SLA ------------------------------------- */
  let sinFechaInicio = 0;
  let inconsistentes = 0;
  let sinFechaEntrega = 0;
  const horas: number[] = [];
  const horasPorMes = new Map<string, number[]>();

  for (const r of entregadas) {
    const fin = r.reportDeliveredAt;
    if (fin == null) {
      sinFechaEntrega++;
      continue;
    }
    const ini = r.inspectionStartAt;
    if (ini == null) {
      sinFechaInicio++;
      continue;
    }
    if (fin < ini) {
      // Entregar antes de empezar es imposible: se cuenta aparte en vez de
      // meter una duración negativa que hundiría la mediana sin explicación.
      inconsistentes++;
      continue;
    }
    const h = (fin - ini) / HORA_MS;
    horas.push(h);
    const ym = ymFromMs(ini);
    const arr = horasPorMes.get(ym) ?? [];
    arr.push(h);
    horasPorMes.set(ym, arr);
  }

  const porMes = [...horasPorMes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, xs]) => ({
      ym,
      rows: xs.length,
      medianaHoras: redondear(mediana(xs)),
    }));

  return {
    revisiones: {
      total: inspecciones.length,
      entregadas: entregadas.length,
      conChecklist: evaluadas,
    },
    condicion: { niveles, sinDato },
    hallazgos: {
      evaluadas,
      total: totalHallazgos,
      promedioPorRevision:
        evaluadas > 0 ? redondear(totalHallazgos / evaluadas) : 0,
      sinHallazgos,
      porSeccion,
      top,
      fueraDelRanking: candidatos.length - elegibles.length,
      minEvaluaciones: MIN_EVALUACIONES,
      itemsSinCatalogar: [...sinCatalogar].sort(),
    },
    sla: {
      medibles: horas.length,
      entregadas: entregadas.length,
      sinFechaInicio,
      inconsistentes,
      medianaHoras: redondear(mediana(horas)),
      p90Horas: redondear(percentil(horas, 90)),
      maxHoras: redondear(horas.length ? Math.max(...horas) : 0),
      dentroDe24h: horas.filter((h) => h <= 24).length,
      dentroDe48h: horas.filter((h) => h <= 48).length,
      porMes,
      sinFechaEntrega,
    },
    nota: "Hallazgos: la polaridad de cada ítem sale de SECTIONS_CONFIG (`findingWhenNo`), la MISMA que usa el PDF — 18 de los 44 ítems sí/no son hallazgo cuando la respuesta es NO. «No aplica» nunca cuenta. El % de cada ítem va sobre las veces que ese ítem SE EVALUÓ, no sobre el total de revisiones. SLA: solo revisiones entregadas con fecha de inicio y de entrega; `sinFechaInicio` dice cuántas quedaron fuera y `inconsistentes` cuántas traen entrega anterior al inicio. Condición: `biVehicleCondition`, que anota el técnico; los porcentajes van sobre las que tienen dato.",
  };
}
