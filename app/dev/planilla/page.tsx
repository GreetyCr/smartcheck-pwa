import { notFound } from "next/navigation";
import { PlanillaPreview } from "./preview";

/**
 * Revisión visual de la planilla del mes, sin sesión y sin tocar datos.
 * 404 en producción real (mismo criterio que `/dev/finanzas` y `/dev/leads`).
 */
export default function DevPlanillaPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <PlanillaPreview />;
}
