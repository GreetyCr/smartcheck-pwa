import { notFound } from "next/navigation";
import { LeadsPreview } from "./preview";

/**
 * Vista de REVISIÓN VISUAL del tablero de Leads & conversión.
 *
 * Sirve para aprobar el diseño sin iniciar sesión y **sin tocar datos reales**:
 * renderiza los mismos componentes con datos de muestra. Los nombres y
 * teléfonos de la muestra son inventados a propósito — la tabla de "quiénes
 * convirtieron" enseña datos de clientes y esta vista no pide sesión.
 *
 * Disponible en local y en los **Previews de Vercel** (para dar el visto bueno
 * por link), pero **404 en producción real**. No se usa `NODE_ENV`: los
 * Previews también compilan como `production`, así que la guarda mira
 * `VERCEL_ENV`, que solo vale `"production"` en el dominio de producción.
 */
export default function DevLeadsPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <LeadsPreview />;
}
