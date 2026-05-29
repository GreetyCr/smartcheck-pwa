/** URL de sección con query param (una sola ruta RSC → navegación offline). */
export function inspectionSectionHref(
  pathSegment: string,
  sectionId: string,
): string {
  return `/inspecciones/${pathSegment}/seccion?sec=${encodeURIComponent(sectionId)}`;
}
