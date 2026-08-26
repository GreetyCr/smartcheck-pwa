"use client";

import { notFound } from "next/navigation";
import { OperacionPreview } from "./preview";

/**
 * Vista de REVISIÓN VISUAL de RF-07 (hallazgos, condición y tiempos).
 * Misma guarda que las demás: existe en local y en Previews, **404 en
 * producción real** (`VERCEL_ENV`, no `NODE_ENV`: los Previews también
 * compilan como production).
 */
export default function DevOperacionPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <OperacionPreview />;
}
