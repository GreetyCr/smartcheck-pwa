"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import { formatDateCR, formatInt } from "@/lib/bi-format";
import { cn } from "@/lib/utils";

export type EstadoDatos = {
  procesos: Array<{
    key: string;
    etiqueta: string;
    queEs: string;
    cadencia: string;
    lastRunAt: number;
    lastStatus: string;
    message: string | null;
    rowsProcessed: number | null;
    diasDesde: number;
    atrasado: boolean;
  }>;
  ultimaActualizacion: number | null;
  hayError: boolean;
  hayAtraso: boolean;
  sinDeclarar: string[];
  diasParaAtraso: number;
};

/** «hace 3 horas» / «hace 2 días». Con menos de una hora, «recién». */
function haceCuanto(dias: number): string {
  const horas = dias * 24;
  if (horas < 1) return "recién";
  if (horas < 24) return `hace ${Math.round(horas)} h`;
  const d = Math.round(dias);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

/**
 * Estado y frescura de los datos — **RF-09** (última actualización), **RF-08**
 * (actualizar ahora) y la mitad que faltaba de **RF-16** (avisar si el sync
 * falló).
 *
 * El requerimiento pedía literalmente *«no mostrar datos viejos en silencio»*.
 * El backend llevaba semanas escribiendo la hora y el resultado de cada proceso
 * en `bi_meta`, y **ninguna pantalla los leía**: si el cron del lunes fallaba, el
 * tablero seguía mostrando los números de la semana pasada sin decir nada. Esta
 * tarjeta es la boca de esa vigilancia.
 *
 * Dos decisiones:
 *
 * 1. **El titular es una frase, no una tabla.** Lo primero que se lee tiene que
 *    contestar «¿puedo confiar en lo que estoy viendo?» sin interpretar cinco
 *    fechas. El detalle por proceso va debajo, para cuando algo falla.
 * 2. **Los dos botones dicen qué hacen y cuánto tardan.** «Actualizar» a secas
 *    invita a pulsarlo dos veces; traer 9.000 contactos de Airtable tarda cerca
 *    de un minuto y el resultado no aparece al instante — se agenda. Si la
 *    pantalla no lo dice, el silencio se lee como que no funcionó.
 */
export function EstadoDatosCard({
  data,
  onActualizarLeads,
  onRecalcular,
}: {
  data: EstadoDatos;
  onActualizarLeads?: () => Promise<unknown>;
  onRecalcular?: () => Promise<unknown>;
}) {
  const [corriendo, setCorriendo] = useState<"leads" | "bi" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function lanzar(cual: "leads" | "bi", fn?: () => Promise<unknown>) {
    if (!fn) return;
    setCorriendo(cual);
    setAviso(null);
    try {
      await fn();
      setAviso(
        cual === "leads"
          ? "Pedido enviado. Traer los contactos de Airtable tarda cerca de un minuto; recargá la página en un rato para ver la hora nueva."
          : "Pedido enviado. El recálculo tarda unos segundos; recargá la página para ver la hora nueva.",
      );
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo pedir la actualización.");
    } finally {
      setCorriendo(null);
    }
  }

  const estado = data.hayError
    ? {
        Icon: CircleAlert,
        color: "var(--bi-expense)",
        titulo: "Un proceso falló",
        detalle:
          "Los números de abajo pueden estar incompletos. Mirá el detalle y avisanos.",
      }
    : data.hayAtraso
      ? {
          Icon: TriangleAlert,
          color: "var(--bi-warn)",
          titulo: "Hay datos sin actualizar",
          detalle: `Algo lleva más de ${data.diasParaAtraso} días sin correr, y debería hacerlo cada semana.`,
        }
      : {
          Icon: CheckCircle2,
          color: "var(--bi-good)",
          titulo: "Los datos están al día",
          detalle:
            data.ultimaActualizacion !== null
              ? `Última actualización: ${formatDateCR(data.ultimaActualizacion)}.`
              : "Todavía no ha corrido ninguna actualización.",
        };

  return (
    <BiCard title="Estado de los datos" subtitle="De cuándo es lo que estás viendo">
      {/* El titular: contesta «¿puedo confiar en esto?» sin leer la tabla. */}
      <div className="flex items-start gap-3">
        <estado.Icon
          className="mt-0.5 size-5 shrink-0"
          style={{ color: estado.color }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[var(--bi-ink)]">
            {estado.titulo}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
            {estado.detalle}
          </p>
        </div>
      </div>

      {/* Detalle por proceso */}
      <ul className="mt-4 space-y-2.5 border-t border-[var(--bi-ring)] pt-4">
        {data.procesos.map((p) => {
          const mal = p.lastStatus === "error";
          return (
            <li key={p.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 translate-y-[-1px] rounded-full"
                    style={{
                      background: mal
                        ? "var(--bi-expense)"
                        : p.atrasado
                          ? "var(--bi-warn)"
                          : "var(--bi-good)",
                    }}
                  />
                  {/* Sin `truncate`: a 375 px la etiqueta se queda con 123 px
                      y «Carga del sistema anterior» (180 px) se cortaba en
                      «Carga del sistema an…». Son cinco nombres fijos y el
                      renglón puede envolver sin apretar nada. */}
                  <span className="text-[13.5px] leading-snug text-[var(--bi-ink)]">
                    {p.etiqueta}
                  </span>
                  {p.cadencia === "unica" ? (
                    <span className="shrink-0 text-[11px] text-[var(--bi-ink-3)]">
                      carga única
                    </span>
                  ) : null}
                </span>
                <span className="bi-num shrink-0 text-[12px] tabular-nums text-[var(--bi-ink-3)]">
                  {haceCuanto(p.diasDesde)}
                </span>
              </div>
              <p className="ml-4 mt-0.5 text-[11.5px] leading-relaxed text-[var(--bi-ink-3)]">
                {p.queEs}
                {p.rowsProcessed !== null ? (
                  <> {formatInt(p.rowsProcessed)} filas.</>
                ) : null}
              </p>
              {mal && p.message ? (
                <p className="ml-4 mt-0.5 text-[11.5px] text-[var(--bi-expense)]">
                  {p.message}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {data.sinDeclarar.length > 0 ? (
        <p className="mt-3 text-[11.5px] text-[var(--bi-warn)]">
          Proceso nuevo sin describir: {data.sinDeclarar.join(", ")}. Se vigila
          como si fuera semanal hasta que lo revisemos.
        </p>
      ) : null}

      {/* RF-08 */}
      {onActualizarLeads || onRecalcular ? (
        <div className="mt-4 border-t border-[var(--bi-ring)] pt-4">
          <div className="flex flex-wrap gap-2">
            {onActualizarLeads ? (
              <button
                type="button"
                onClick={() => lanzar("leads", onActualizarLeads)}
                disabled={corriendo !== null}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--bi-income)]/40 bg-[var(--bi-income)]/10 px-4 text-sm font-semibold text-[var(--bi-income)] transition-colors",
                  "hover:bg-[var(--bi-income)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {corriendo === "leads" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-4" aria-hidden />
                )}
                Traer contactos de Airtable
              </button>
            ) : null}

            {onRecalcular ? (
              <button
                type="button"
                onClick={() => lanzar("bi", onRecalcular)}
                disabled={corriendo !== null}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--bi-ring)] px-4 text-sm font-semibold text-[var(--bi-ink-2)] transition-colors",
                  "hover:bg-[var(--bi-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {corriendo === "bi" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Clock className="size-4" aria-hidden />
                )}
                Solo recalcular conversiones
              </button>
            ) : null}
          </div>

          <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--bi-ink-3)]">
            El primero va a Airtable a buscar contactos nuevos —tarda cerca de un
            minuto— y al terminar recalcula las conversiones solo. El segundo no
            sale a buscar nada: sirve cuando cambió algo de este lado, como una
            revisión nueva o un monto corregido.
          </p>

          {aviso ? (
            <p className="mt-2 text-[12.5px] text-[var(--bi-ink-2)]">{aviso}</p>
          ) : null}
        </div>
      ) : null}
    </BiCard>
  );
}
