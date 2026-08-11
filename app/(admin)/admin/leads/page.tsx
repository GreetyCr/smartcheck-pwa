"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LeadsDashboard } from "@/components/bi/LeadsDashboard";

/**
 * Tablero de Leads & conversión — lee `bi/public:{conversionFunnel,
 * matchesStats, leadsStats}`. Las tres exigen rol admin en el backend
 * (`requireAdmin`); el layout de `/admin` además cierra la UI a no-admins.
 *
 * La muestra de "quiénes convirtieron" trae nombre y teléfono de clientes
 * reales. Es un tablero solo-admin, así que se muestran —pero no salen a
 * consola ni a ningún log: acá no se instrumenta nada sobre esta respuesta.
 */
export default function LeadsPage() {
  const funnel = useQuery(api.bi.public.conversionFunnel, { sampleSize: 12 });
  const matches = useQuery(api.bi.public.matchesStats, {});
  const leads = useQuery(api.bi.public.leadsStats, {});

  // Las tres se piden juntas y el tablero cruza sus cifras entre sí (los 238
  // emparejamientos, los 180 titulares, los 8.706 leads). Renderizar con una
  // sola cargada mostraría totales que no cuadran por un instante.
  if (funnel === undefined || matches === undefined || leads === undefined) {
    return (
      <div>
        <div className="bi-skeleton h-9 w-64 rounded-lg" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bi-skeleton h-[110px] rounded-2xl" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.9fr_1fr]">
          <div className="bi-skeleton h-[280px] rounded-2xl" />
          <div className="bi-skeleton h-[280px] rounded-2xl" />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="bi-skeleton h-[260px] rounded-2xl" />
          <div className="bi-skeleton h-[260px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return <LeadsDashboard funnel={funnel} matches={matches} leads={leads} />;
}
