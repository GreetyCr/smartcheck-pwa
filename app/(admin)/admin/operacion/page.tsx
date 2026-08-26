"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperacionDashboard } from "@/components/bi/OperacionDashboard";

/**
 * Hallazgos, condición y tiempos de respuesta — **RF-07**.
 *
 * Solo capa de datos: `bi/public:operacion` exige rol admin en el backend y el
 * render es presentacional, para que `/dev/operacion` pueda pintarlo con datos
 * de muestra.
 */
export default function OperacionPage() {
  const data = useQuery(api.bi.public.operacion, {});

  if (data === undefined) {
    return (
      <div>
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

  return <OperacionDashboard data={data} />;
}
