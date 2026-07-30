import { notFound } from "next/navigation";
import { AdminTablesPreview } from "./preview";

/**
 * Vista de REVISIÓN VISUAL de las filas de tabla del panel
 * (`InspectionTableRow` y `TechnicianRow`) sobre el fondo grafito.
 *
 * Existe porque `/admin/inspecciones` y `/admin/tecnicos` están detrás del
 * login: sin esta ruta no habría forma de comprobar que no quedó texto oscuro
 * sobre oscuro. Misma guarda que el resto de `app/dev/*`: 404 en producción.
 */
export default function DevAdminTablasPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <AdminTablesPreview />;
}
