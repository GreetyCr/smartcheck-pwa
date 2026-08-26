"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperacionDashboard } from "@/components/bi/OperacionDashboard";
import {
  FiltrosGlobales,
  useFiltrosBi,
} from "@/components/bi/FiltrosGlobales";

/**
 * Las ocho dimensiones, todas.
 *
 * Este tablero solo ve revisiones **de la app** —el checklist y las fechas de
 * entrega no existen en el CRM viejo—, así que `sellerType`, que también es
 * solo de la app, acá no pierde nada extra.
 */
const SOPORTA = [
  "periodo",
  "channel",
  "province",
  "engineType",
  "agency",
  "brand",
  "sellerType",
  "currency",
] as const;

/**
 * Hallazgos, condición y tiempos de respuesta — **RF-07**.
 *
 * Solo capa de datos: `bi/public:operacion` exige rol admin en el backend y el
 * render es presentacional, para que `/dev/operacion` pueda pintarlo con datos
 * de muestra.
 */
export default function OperacionPage() {
  const { args } = useFiltrosBi(SOPORTA);
  const data = useQuery(api.bi.public.operacion, args);

  if (data === undefined) {
    return (
      <div>
        <FiltrosGlobales soporta={SOPORTA} />
        <div className="bi-skeleton h-9 w-64 rounded-lg" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bi-skeleton h-[110px] rounded-2xl" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <div className="bi-skeleton h-[420px] rounded-2xl" />
          <div className="bi-skeleton h-[420px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <FiltrosGlobales soporta={SOPORTA} />
      <OperacionDashboard data={data} />
    </div>
  );
}
