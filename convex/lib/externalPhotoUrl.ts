/**
 * URLs de fotos externas (p. ej. UploadThing) guardadas como string en `itemPhotos`.
 * Normaliza `//host/...` y valida que no sean blob/data locales.
 */
export function normalizeStoredPhotoUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("blob:") || t.startsWith("data:image")) return null;
  if (t.startsWith("//")) return `https:${t}`;
  if (/^https?:\/\//i.test(t)) return t;
  return t;
}

export function isExternalPhotoString(ref: string): boolean {
  return normalizeStoredPhotoUrl(ref) !== null;
}
