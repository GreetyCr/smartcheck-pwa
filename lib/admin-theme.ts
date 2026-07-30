/**
 * Clases del tema del panel admin ("grafito de precisión").
 *
 * Vive fuera de los componentes porque hay **dos dueños posibles** del tema y
 * tienen que pintar exactamente igual:
 *  1. `AdminAppShell` — el shell real de `/admin/*`.
 *  2. Las vistas de revisión de `app/dev/*`, que renderizan los tableros fuera
 *     del shell (sin login) y por eso replican el contenedor.
 *
 * Antes cada tablero pintaba su propio fondo y cancelaba el padding del `main`
 * con márgenes negativos (`-m-4 md:-m-6 lg:-m-8`). Ahora el contenedor es el
 * único que aplica plano y tinta; los tableros solo maquetan su contenido.
 */

/** Superficie + tinta del panel. Aplicar al contenedor que envuelve el tablero. */
export const ADMIN_THEME_CLASS =
  "bi-graphite bg-[var(--bi-plane)] text-[var(--bi-ink)]";

/** Padding del área de contenido (idéntico en el shell y en las vistas dev). */
export const ADMIN_CONTENT_PADDING = "p-4 md:p-6 lg:p-8";
