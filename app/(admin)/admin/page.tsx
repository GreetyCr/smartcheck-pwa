"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { ResumenEjecutivo } from "@/components/bi/ResumenEjecutivo";
import {
  rangoAnterior,
  rangoDelPeriodo,
  type PeriodoKey,
} from "@/components/bi/ExpenseGroupsCard";
import {
  FiltrosGlobales,
  useFiltrosBi,
} from "@/components/bi/FiltrosGlobales";

/**
 * Dimensiones que esta portada honra de verdad.
 *
 * El periodo NO está: el resumen ya trae su propio selector, que además maneja
 * los **dos alcances** de la pantalla (lo que se mueve y lo que no). Meter el
 * periodo también en la barra global daría dos controles del mismo eje, y el
 * que perdiera se leería como roto.
 */
const SOPORTA = [
  "channel",
  "province",
  "engineType",
  "agency",
  "brand",
  "sellerType",
  "currency",
] as const;

/**
 * Portada del panel admin — **RF-03 arriba, operativo abajo**.
 *
 * La portada trae las dos cosas y no una en vez de la
 * otra: el resumen del negocio primero (revisiones, plata, conversión,
 * tendencia, canales) y debajo lo operativo de la PWA que ya estaba
 * (inspecciones de hoy, sin sincronizar, actividad por técnico). Son dos
 * preguntas distintas —«¿cómo va el negocio?» y «¿qué pasó hoy?»— y las dos se
 * hacen al abrir el panel.
 *
 * Solo capa de datos: las dos mitades son presentacionales y reciben lo suyo ya
 * resuelto, para que `app/dev/admin` pueda pintarlas con datos de muestra.
 *
 * **Cuatro consultas y no una.** `executiveSummary` se pide dos veces —con
 * periodo y sin él— a propósito: el requerimiento pide el total de revisiones
 * *histórico* junto a KPIs *del periodo*, y derivar el histórico de una
 * respuesta filtrada sería imposible. Con «Todo» los argumentos coinciden y
 * Convex resuelve la misma suscripción una sola vez.
 */
export default function AdminDashboardPage() {
  const [periodo, setPeriodo] = useState<PeriodoKey>("todo");
  const rango = useMemo(() => rangoDelPeriodo(periodo), [periodo]);
  /** El tramo previo del mismo largo, para poder decir «cuánto más que antes». */
  const previo = useMemo(() => rangoAnterior(periodo), [periodo]);
  const { args: dims } = useFiltrosBi(SOPORTA);

  const historico = useQuery(api.bi.public.executiveSummary, dims);
  const delPeriodo = useQuery(api.bi.public.executiveSummary, {
    ...dims,
    ...rango,
  });
  /* El periodo anterior (A135). Con «Todo» no hay un antes, así que la query se
     salta en vez de pedir un rango vacío que devolvería el histórico entero y
     produciría una comparación falsa contra sí mismo. */
  const delPeriodoPrevio = useQuery(
    api.bi.public.executiveSummary,
    previo ? { ...dims, ...previo } : "skip",
  );
  // Finanzas solo entiende de periodo: un gasto no tiene provincia ni marca.
  const finanzas = useQuery(api.bi.public.financeSummary, rango);
  const canales = useQuery(api.bi.public.channelRevenue, { ...dims, ...rango });
  const metrics = useQuery(api.admin.getDashboardMetrics, {});

  const resumenListo =
    historico !== undefined &&
    delPeriodo !== undefined &&
    finanzas !== undefined &&
    canales !== undefined;

  return (
    <div>
      <FiltrosGlobales
        soporta={SOPORTA}
        notaPeriodo="El periodo se elige abajo, en el resumen."
      />

      {resumenListo ? (
        <ResumenEjecutivo
          periodo={delPeriodo}
          historico={historico}
          anterior={previo ? delPeriodoPrevio : null}
          meses={finanzas.months}
          canales={canales.canales}
          periodoKey={periodo}
          onPeriodo={setPeriodo}
          filtrosGlobales={Object.keys(dims).length}
        />
      ) : (
        <ResumenSkeleton />
      )}

      {/* Separador con nombre: sin él, las tarjetas de abajo se leen como más
          KPIs del resumen y «Inspecciones hoy» compite con «Ingresos». */}
      <div className="mt-10 border-t border-[var(--bi-ring)] pt-8">
        {metrics !== undefined ? (
          <AdminDashboard
            metrics={metrics}
            revisionesHistorico={historico?.totalRevisiones}
          />
        ) : (
          <OperativoSkeleton />
        )}
      </div>
    </div>
  );
}

function ResumenSkeleton() {
  return (
    <div>
      <div className="bi-skeleton h-9 w-72 rounded-lg" />
      {[0, 1].map((fila) => (
        <div key={fila}>
          <div className="mb-2 mt-5 h-3 w-40 rounded bg-[var(--bi-surface-2)]" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bi-skeleton h-[110px] rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="bi-skeleton h-[320px] rounded-2xl" />
        <div className="bi-skeleton h-[320px] rounded-2xl" />
      </div>
    </div>
  );
}

function OperativoSkeleton() {
  return (
    <div>
      <div className="bi-skeleton h-7 w-56 rounded-lg" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bi-skeleton h-[110px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="bi-skeleton h-[300px] rounded-2xl" />
        <div className="bi-skeleton h-[300px] rounded-2xl" />
      </div>
    </div>
  );
}
