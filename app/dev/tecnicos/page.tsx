import { notFound } from "next/navigation";
import { TecnicosPreview } from "./preview";

/**
 * Revisión visual de Técnicos y usuarios.
 * 404 en producción real, igual que el resto de `/dev`.
 */
export default function DevTecnicosPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <TecnicosPreview />;
}
