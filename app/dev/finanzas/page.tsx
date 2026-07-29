import { notFound } from "next/navigation";
import { FinanzasPreview } from "./preview";

/**
 * Vista de REVISIÓN VISUAL del tablero de Finanzas.
 *
 * Sirve para aprobar el diseño (tipografía, contraste, microinteracciones) sin
 * iniciar sesión y **sin tocar datos reales**: renderiza los mismos componentes
 * con datos de muestra y las acciones de escritura desactivadas.
 *
 * No existe en producción (404) — es una herramienta de desarrollo.
 */
export default function DevFinanzasPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FinanzasPreview />;
}
