"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FeriadosDashboard } from "@/components/bi/FeriadosDashboard";

/**
 * Calendario de feriados — **RF-20 · RF-21 · RF-22**.
 *
 * **No lleva la barra de filtros global**, y es a propósito: un feriado no tiene
 * provincia, ni marca, ni canal, y su periodo lo elige el selector de año de la
 * propia tarjeta. Poner la barra acá la dejaría entera apagada, que es peor que
 * no ponerla — enseñaría siete controles muertos.
 *
 * El año vive en estado local y no en la URL porque no hay nada que compartir:
 * el calendario del año es el mismo para cualquiera que lo abra.
 */
export default function FeriadosPage() {
  const [anio, setAnio] = useState<number | undefined>(undefined);
  const panel = useQuery(api.bi.public.feriados, anio ? { anio } : {});

  if (panel === undefined) {
    return (
      <div>
        <div className="bi-skeleton h-9 w-48 rounded-lg" />
        <div className="bi-skeleton mt-6 h-[220px] rounded-2xl" />
        <div className="bi-skeleton mt-4 h-[420px] rounded-2xl" />
      </div>
    );
  }

  return <FeriadosDashboard panel={panel} onCambiarAnio={setAnio} />;
}
