import { notFound } from "next/navigation";
import { FinanzasPreview } from "./preview";

/**
 * Vista de REVISIÓN VISUAL del tablero de Finanzas.
 *
 * Sirve para aprobar el diseño (tipografía, contraste, microinteracciones) sin
 * iniciar sesión y **sin tocar datos reales**: renderiza los mismos componentes
 * con datos de muestra y las acciones de escritura desactivadas.
 *
 * Disponible en local y en los **Previews de Vercel** (para que se pueda dar el
 * visto bueno por link), pero **404 en producción real**. No se usa `NODE_ENV`:
 * los Previews también compilan como `production`, así que la guarda mira
 * `VERCEL_ENV`, que solo vale `"production"` en el dominio de producción.
 */
export default function DevFinanzasPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <FinanzasPreview />;
}
