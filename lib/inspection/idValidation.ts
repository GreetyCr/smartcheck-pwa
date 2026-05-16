/**
 * Discriminación de strings en URLs de inspección (`resolveInspectionRef`).
 * Heurística por **forma**; la autoridad final sigue siendo Convex (`get` /
 * `getByClientId`) + permisos.
 *
 * `looksLikeConvexInspectionId` refleja el encoding típico de document IDs
 * (base32-like, sin guiones, longitud acotada). Si Convex expone un helper
 * público estable, reemplazar solo el cuerpo de esa función sin tocar callers.
 */

/** UUID v4 canónico (8-4-4-4-12): versión 4 y variante RFC 4122 (8/9/a/b). */
export function isUuidV4(s: string): boolean {
  const t = s.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    t,
  );
}

const CONVEX_ID_LEN_MIN = 28;
const CONVEX_ID_LEN_MAX = 36;

/**
 * Forma típica de `Id<"inspections">` en Convex (string opaco, sin guiones).
 * No garantiza que exista ni que pertenezca a la tabla `inspections`.
 */
export function looksLikeConvexInspectionId(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (t.length < CONVEX_ID_LEN_MIN || t.length > CONVEX_ID_LEN_MAX) return false;
  if (t.includes("-")) return false;
  if (!/^[a-z0-9]+$/.test(t)) return false;
  return true;
}
