import { notFound } from "next/navigation";
import { EstadoPreview } from "./preview";

/**
 * Revisión visual del estado de los datos (RF-08 · RF-09 · RF-16).
 * 404 en producción real, igual que el resto de `/dev`.
 */
export default function DevEstadoPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <EstadoPreview />;
}
