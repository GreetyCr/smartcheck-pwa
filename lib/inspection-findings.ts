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

function legacyCountInValue(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "object" && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    if ("value" in o) {
      const vv = o.value;
      if (vv === "reparacion" || vv === "no") return 1;
    }
    let s = 0;
    for (const k of Object.keys(o)) {
      s += legacyCountInValue(o[k]);
    }
    return s;
  }
  return 0;
}

function countChoiceItem(item: SectionItem, val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val !== "object" || Array.isArray(val)) return 0;
  const o = val as Record<string, unknown>;
  if (!("value" in o)) return 0;

  const vv = o.value as string | undefined;
  if (vv === undefined) return 0;

  const t = item.type;

  if (t === "bien_reparacion" || t === "bien_reparacion_na") {
    return vv === "reparacion" ? 1 : 0;
  }

  if (t === "si_no" || t === "si_no_na") {
    if (item.positiveWhenNo) {
      return vv === "si" ? 1 : 0;
    }
    return vv === "no" ? 1 : 0;
  }

  return legacyCountInValue(val);
}

/**
 * Hallazgos por sección para PDF y listados.
 * `positiveWhenNo`: ausencia del defecto es buena (ej. «No» en herrumbre).
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
