import {
  SECTIONS_CONFIG,
  type SectionItem,
} from "@/lib/constants/sectionItems";

const SKIP = new Set([
  "itemPhotos",
  "photos",
  "inspectionId",
  "_id",
  "_creationTime",
]);

/** Ítem del checklist que cuenta como hallazgo (PDF / resúmenes / Convex). */
export function itemCountsAsFinding(item: SectionItem, val: unknown): boolean {
  return countChoiceItem(item, val) > 0;
}

function countChoiceItem(item: SectionItem, val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val !== "object" || Array.isArray(val)) return 0;
  const o = val as Record<string, unknown>;
  if (!("value" in o)) return 0;

  const vv = o.value as string | undefined;
  if (vv === undefined || vv === "na") return 0;

  const t = item.type;

  if (t === "bien_reparacion" || t === "bien_reparacion_na") {
    return vv === "reparacion" ? 1 : 0;
  }

  if (t === "si_no" || t === "si_no_na") {
    if (item.findingWhenNo) {
      return vv === "no" ? 1 : 0;
    }
    /** Defecto o anomalía presente (default y `positiveWhenNo`). */
    return vv === "si" ? 1 : 0;
  }

  return legacyCountInValue(val);
}

function legacyCountInValue(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "object" && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    if ("value" in o) {
      const vv = o.value;
      if (vv === "reparacion" || vv === "si") return 1;
    }
    let s = 0;
    for (const k of Object.keys(o)) {
      s += legacyCountInValue(o[k]);
    }
    return s;
  }
  return 0;
}

/**
 * Detalle por ítem de una sección: qué se evaluó y qué salió con hallazgo.
 *
 * **No reemplaza a `countFindingsForSectionDoc`, y es a propósito.** Aquella
 * suma —y además tiene el camino `legacyCountInValue`, que recorre formas
 * desconocidas y puede devolver más de uno por clave—; alimenta el PDF y sus
 * números están en informes ya entregados, así que no se toca. Esta contesta
 * otra pregunta —*qué ítem* falló, no *cuántos*— y para eso necesita claves.
 * Las dos comparten la única regla que importa, `itemCountsAsFinding`, así que
 * la polaridad no puede divergir entre una y otra.
 *
 * `evaluados` trae solo los ítems con respuesta distinta de `na`: es el
 * denominador honesto para «cada cuánto sale esto». Contar sobre todas las
 * revisiones haría ver seguro a un ítem que casi nunca se evalúa.
 *
 * `sinCatalogar` son claves que están en el documento y **no** en
 * `SECTIONS_CONFIG`. Se devuelven en vez de ignorarse: si mañana se agrega un
 * ítem al formulario y nadie lo agrega al catálogo, tiene que verse (A64), no
 * desaparecer de las estadísticas en silencio.
 */
export function findingsByItemForSectionDoc(
  sectionTable: string,
  doc: Record<string, unknown> | null,
): { evaluados: string[]; hallazgos: string[]; sinCatalogar: string[] } {
  const evaluados: string[] = [];
  const hallazgos: string[] = [];
  const sinCatalogar: string[] = [];
  if (!doc) return { evaluados, hallazgos, sinCatalogar };

  const cfg = SECTIONS_CONFIG.find((s) => s.table === sectionTable);

  for (const [key, val] of Object.entries(doc)) {
    if (SKIP.has(key)) continue;
    if (val === null || val === undefined) continue;

    const item = cfg?.items.find((i) => i.key === key);
    if (!item) {
      // Solo interesa lo que parece una respuesta de checklist: `notas_adicional`
      // y compañía son texto libre y no tienen polaridad que declarar.
      if (typeof val === "object" && !Array.isArray(val) && "value" in val) {
        sinCatalogar.push(`${sectionTable}.${key}`);
      }
      continue;
    }
    if (
      item.type !== "bien_reparacion" &&
      item.type !== "bien_reparacion_na" &&
      item.type !== "si_no" &&
      item.type !== "si_no_na"
    ) {
      continue;
    }

    const v = val as { value?: string };
    if (typeof val !== "object" || Array.isArray(val) || v.value === undefined) {
      continue;
    }
    if (v.value === "na") continue;

    evaluados.push(key);
    if (itemCountsAsFinding(item, val)) hallazgos.push(key);
  }

  return { evaluados, hallazgos, sinCatalogar };
}

/**
 * Hallazgos por sección (PDF, listado de secciones, resumen ejecutivo).
 *
 * - Ítems tipo defecto/anomalía (ej. «Ruidos anormales», «Reparación prematura»): **Sí** = hallazgo.
 * - `positiveWhenNo`: pregunta «¿Hay X malo?» — **Sí** = hallazgo, **No** = OK.
 * - `findingWhenNo`: pieza o condición deseable — **No** = hallazgo (falta o no cumple).
 */
export function countFindingsForSectionDoc(
  sectionTable: string,
  doc: Record<string, unknown> | null,
): number {
  if (!doc) return 0;
  const cfg = SECTIONS_CONFIG.find((s) => s.table === sectionTable);

  let sum = 0;
  for (const [key, val] of Object.entries(doc)) {
    if (SKIP.has(key)) continue;
    const item = cfg?.items.find((i) => i.key === key);
    if (
      item &&
      (item.type === "bien_reparacion" ||
        item.type === "bien_reparacion_na" ||
        item.type === "si_no" ||
        item.type === "si_no_na")
    ) {
      sum += countChoiceItem(item, val);
      continue;
    }
    sum += legacyCountInValue(val);
  }
  return sum;
}
