"use client";

import { notFound } from "next/navigation";
import { FeriadosPreview } from "./preview";

/**
 * Vista de REVISIÓN VISUAL del calendario de feriados (A117). Misma guarda que
 * las demás: existe en local y en Previews, **404 en producción real**.
 */
export default function DevFeriadosPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <FeriadosPreview />;
}
