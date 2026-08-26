"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LeadsDashboard } from "@/components/bi/LeadsDashboard";
import { BotSwitchCard } from "@/components/bi/BotSwitchCard";

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
  /* `sampleSize: 0` apaga la muestra del embudo: la lista completa la sirve
     `convertedLeads`, así que traer 25 nombres y teléfonos que nadie va a
     pintar sería mandar PII al navegador por nada. */
  const funnel = useQuery(api.bi.public.conversionFunnel, { sampleSize: 0 });
  const matches = useQuery(api.bi.public.matchesStats, {});
  const leads = useQuery(api.bi.public.leadsStats, {});
  const porRevisar = useQuery(api.bi.public.leadsPorRevisar, {});
  const converted = useQuery(api.bi.public.convertedLeads, {});
  /* El on/off va aparte del bloqueo de abajo: es un control, no una cifra que
     tenga que cuadrar con las demás. Si tarda, que no retrase el tablero; y si
     el tablero tarda, que el interruptor ya esté a mano. */
  const bot = useQuery(api.bots.public.botStatus, {});

  // Se piden juntas y el tablero cruza sus cifras entre sí (los 238
  // emparejamientos, los 217 titulares, los 9.096 leads). Renderizar con una
  // sola cargada mostraría totales que no cuadran por un instante.
  if (
    funnel === undefined ||
    matches === undefined ||
    leads === undefined ||
    porRevisar === undefined ||
    converted === undefined
  ) {
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
        <div className="bi-skeleton mt-4 h-[360px] rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      {bot ? (
        <div className="mb-4">
          <BotSwitchCard estado={bot} />
        </div>
      ) : null}
      <LeadsDashboard
        funnel={funnel}
        matches={matches}
        leads={leads}
        porRevisar={porRevisar}
        converted={converted}
      />
    </>
  );
}
