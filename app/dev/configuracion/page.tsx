import { notFound } from "next/navigation";
import { ConfiguracionPreview } from "./preview";

/**
 * Revisión visual de Configuración.
 * 404 en producción real, igual que el resto de `/dev`.
 */
export default function DevConfiguracionPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <ConfiguracionPreview />;
}
