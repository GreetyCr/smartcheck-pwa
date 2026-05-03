import { countFindingsForSectionDoc } from "@/lib/inspection-findings";

/** @deprecated Usar countFindingsForSectionDoc con `sectionTable`. */
export function countFindingsInDoc(
  doc: Record<string, unknown> | null,
  sectionTable?: string,
): number {
  if (!sectionTable) {
    return legacyCountFindingsInDoc(doc);
  }
  return countFindingsForSectionDoc(sectionTable, doc);
}

/** Sin tabla de catálogo: heurística anterior (solo compatibilidad). */
function legacyCountFindingsInDoc(doc: Record<string, unknown> | null): number {
  if (!doc) return 0;
  let sum = 0;
  for (const [key, val] of Object.entries(doc)) {
    if (
      key === "itemPhotos" ||
      key === "photos" ||
      key === "inspectionId" ||
      key === "_id" ||
      key === "_creationTime"
    ) {
      continue;
    }
    sum += legacyCountInValue(val);
  }
  return sum;
}

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
