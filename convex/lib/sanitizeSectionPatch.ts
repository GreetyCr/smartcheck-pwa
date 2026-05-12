/**
 * Normaliza el payload de `upsertSection` antes de patch/insert para que pase el
 * validador de Convex (p. ej. `null` en `observation` opcional, refs blob locales).
 */
import { normalizeStoredPhotoUrl } from "./externalPhotoUrl";

export function sanitizeSectionPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;

    if (key === "itemPhotos") {
      if (!val || typeof val !== "object" || Array.isArray(val)) continue;
      const cleaned: Record<string, string[]> = {};
      for (const [itemKey, arr] of Object.entries(
        val as Record<string, unknown>,
      )) {
        if (!Array.isArray(arr)) continue;
        const refs = arr
          .map((x) => {
            if (typeof x !== "string" || !x.trim()) return null;
            const ext = normalizeStoredPhotoUrl(x);
            if (ext) return ext;
            if (x.startsWith("blob:") || x.startsWith("data:image")) return null;
            return x.trim();
          })
          .filter((u): u is string => u !== null);
        if (refs.length > 0) cleaned[itemKey] = refs;
      }
      if (Object.keys(cleaned).length > 0) out.itemPhotos = cleaned;
      continue;
    }

    if (key === "photos") {
      if (!Array.isArray(val)) continue;
      const ids = val.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      );
      if (ids.length > 0) out.photos = ids;
      continue;
    }

    if (
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      "value" in (val as object)
    ) {
      const o = { ...(val as Record<string, unknown>) };
      if (o.observation === null || o.observation === undefined) {
        delete o.observation;
      } else if (typeof o.observation !== "string") {
        o.observation = String(o.observation);
      }
      out[key] = o;
      continue;
    }

    if (val === null) continue;
    out[key] = val;
  }

  return out;
}
