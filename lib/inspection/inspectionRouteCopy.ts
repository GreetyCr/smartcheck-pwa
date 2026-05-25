/**
 * Textos de ruta / inspección (PR-E2).
 *
 * **Copy provisional:** `BADGE_LOCAL_DRAFT` y `SECTIONS_OFFLINE_HINT` son sugerencias
 * internas hasta confirmación de producto (24h); si cambian, actualizar aquí y en el PR.
 *
 * @see docs/MIGRACION_LOCAL_FIRST_CHECKLIST.md — decisión 2 y refinamiento 5.
 */
export const INSPECTION_ROUTE_COPY = {
  NOT_FOUND_TITLE: "Inspección no encontrada",
  NOT_FOUND_CTA: "Iniciar nueva inspección",
  CABECERA_HINT_READONLY:
    "Se podrá editar cuando el informe esté sincronizado",
  CABECERA_CTA_SYNC: "Sincronizar ahora",
  /** Provisional — producto */
  BADGE_LOCAL_DRAFT: "Borrador local",
  /** Provisional — producto (alineado al hint de cabecera si se unifica después) */
  SECTIONS_OFFLINE_HINT:
    "Se podrá editar cuando el informe esté sincronizado",
} as const;
