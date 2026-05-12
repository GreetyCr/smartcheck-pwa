/** Normaliza URL pública de imagen (UploadThing, CDN) en el cliente. */
export function normalizePublicPhotoUrl(url: string): string {
  const t = url.trim();
  if (t.startsWith("//")) return `https:${t}`;
  return t;
}
