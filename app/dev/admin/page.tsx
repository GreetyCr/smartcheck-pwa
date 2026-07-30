import { notFound } from "next/navigation";
import { AdminShellPreview } from "./preview";

/**
 * Vista de REVISIÓN VISUAL del shell del panel admin (menú de navegación +
 * portada del dashboard).
 *
 * Las páginas de `/admin/*` están detrás del login, así que no se pueden mirar
 * sin credenciales. Esta ruta renderiza el **mismo cromo y los mismos
 * componentes** con datos de muestra para aprobar jerarquía, contraste y
 * comportamiento responsive.
 *
 * Misma guarda que `app/dev/finanzas`: existe en local y en los Previews de
 * Vercel, y **404 en producción real**. No se usa `NODE_ENV` (los Previews
 * también compilan como `production`), sino `VERCEL_ENV`.
 */
export default function DevAdminPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <AdminShellPreview />;
}
