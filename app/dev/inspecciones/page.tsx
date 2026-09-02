"use client";

import { notFound } from "next/navigation";
import { InspeccionesPreview } from "./preview";

/**
 * Vista de REVISIÓN VISUAL del control de inspecciones (A114). Misma guarda que
 * las demás: existe en local y en Previews, **404 en producción real**
 * (`VERCEL_ENV`, no `NODE_ENV`: los Previews también compilan como production).
 */
export default function DevInspeccionesPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <InspeccionesPreview />;
}
