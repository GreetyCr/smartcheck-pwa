"use client";

import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ChannelDashboard } from "@/components/bi/ChannelDashboard";

/**
 * Ingresos por canal (F3).
 *
 * La query va acá y el tablero recibe props, como el resto del BI: con
 * `useQuery` dentro del componente, una sesión vencida tumba la pantalla entera
 * (A91).
 */
export default function AdminCanalesPage() {
  const data = useQuery(api.bi.public.channelRevenue, {});

  return (
    <div>
      <header className="mb-6">
        <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
          Ingresos por canal
        </h1>
        <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          De dónde vienen las revisiones y qué devuelve la pauta
        </p>
      </header>

      {data === undefined ? (
        <div className="flex items-center gap-2 text-sm text-[var(--bi-ink-3)]">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : (
        <ChannelDashboard data={data} />
      )}
    </div>
  );
}
