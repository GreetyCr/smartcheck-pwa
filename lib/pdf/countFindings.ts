/** Aproxima hallazgos (reparación / no) para el encabezado de sección. */
export function countFindingsInDoc(doc: Record<string, unknown> | null): number {
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
    sum += countInValue(val);
  }
  return sum;
}

function countInValue(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "object" && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    if ("value" in o) {
      const vv = o.value;
      if (vv === "reparacion" || vv === "no") return 1;
    }
    let s = 0;
    for (const k of Object.keys(o)) {
      s += countInValue(o[k]);
    }
    return s;
  }
  return 0;
}
