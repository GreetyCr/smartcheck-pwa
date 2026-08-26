"use client";

import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { CalidadDashboard } from "@/components/bi/CalidadDashboard";

/**
 * Calidad de los datos (F3).
 *
 * La query va acá y el tablero recibe props, como el resto del BI: con
 * `useQuery` dentro del componente una sesión vencida tumba la pantalla (A91).
 */
export default function AdminCalidadPage() {
  const data = useQuery(api.bi.public.calidad, {});

  return (
    <div>
      <header className="mb-6">
        <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
          Calidad de los datos
        </h1>
        <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          Qué pide acción y qué es ruido esperado
        </p>
      </header>

      {data === undefined ? (
        <div className="flex items-center gap-2 text-sm text-[var(--bi-ink-3)]">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : (
        <CalidadDashboard data={data} />
      )}
    </div>
  );
}
