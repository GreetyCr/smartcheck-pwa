import { notFound } from "next/navigation";
import { FiltrosPreview } from "./preview";

/** Revisión visual de la barra de filtros global (RF-02). 404 en producción. */
export default function DevFiltrosPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <FiltrosPreview />;
}
