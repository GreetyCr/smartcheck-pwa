"use client";

import { useState } from "react";
import { ChevronDown, Info, SlidersHorizontal, X } from "lucide-react";
import { formatInt } from "@/lib/bi-format";
import { cn } from "@/lib/utils";
import {
  PERIODOS_FILTRO,
  contarActivos,
  type DimensionKey,
  type FiltrosBi,
} from "@/lib/bi-filtros";

export type OpcionesFiltro = {
  totalRevisiones: number;
  dimensiones: Array<{
    key: string;
    etiqueta: string;
    opciones: Array<{ valor: string; rows: number }>;
    cobertura: number;
    aviso: string | null;
  }>;
  noDisponibles: Array<{ etiqueta: string; motivo: string }>;
};

/**
 * Barra de filtros global — **RF-02**.
 *
 * ## Las tres decisiones que la hacen honesta
 *
 * **1. Cada opción viene con su cuenta.** «Hyundai (190)» y no «Hyundai». Sin
 * el número, elegir un filtro es a ciegas: no se sabe si va a quedar un tablero
 * o una pantalla vacía. Las opciones y sus cuentas las calcula el backend a
 * partir de los datos, así que una marca nueva aparece sola.
 *
 * **2. Lo que la pantalla no puede filtrar se muestra apagado, con el motivo.**
 * El tablero de canales no acepta filtrar por canal —dejaría una sola barra y
 * el reparto pierde sentido—, y Finanzas solo entiende de periodo, porque un
 * gasto no tiene provincia ni marca. La alternativa sería aceptar el filtro y
 * no aplicarlo, que es exactamente lo que A64 prohíbe: **un filtro que se
 * ignora en silencio es peor que no tenerlo**.
 *
 * **3. Las dimensiones que pierden filas lo advierten.** «Tipo de vendedor»
 * solo lo registra la app: al elegirlo, las 742 revisiones del CRM viejo
 * quedan fuera y el total cae de 887 a 145. Eso se dice **antes** de aplicarlo,
 * no se descubre mirando un número que se desplomó.
 *
 * Y la novena dimensión del requerimiento, **estado de pago**, no está: hoy no
 * hay una sola revisión sin cobrar, así que el control tendría un solo valor.
 * Se lista abajo con su motivo, porque un filtro que falta sin explicación se
 * lee como un olvido.
 */
export function FiltrosBar({
  filtros,
  opciones,
  soporta,
  onCambiar,
  onLimpiar,
  notaPeriodo,
}: {
  filtros: FiltrosBi;
  opciones: OpcionesFiltro | undefined;
  /** Dimensiones que la pantalla actual honra de verdad. */
  soporta: readonly (DimensionKey | "periodo")[];
  onCambiar: (f: FiltrosBi) => void;
  onLimpiar: () => void;
  /**
   * Qué decir cuando la barra no lleva periodo — **A144**.
   *
   * El texto por defecto, «Esta pantalla no se filtra por periodo», es cierto de
   * la **barra** y falso de la **pantalla** en la portada, que tiene su propio
   * selector de periodo tres centímetros más abajo. Leídos juntos se
   * contradicen, y el que pierde es el selector: parece roto.
   *
   * Una pantalla que tiene el control en otro lado dice dónde está.
   */
  notaPeriodo?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const activos = contarActivos(filtros);
  const soportaPeriodo = soporta.includes("periodo");

  return (
    <section
      aria-label="Filtros"
      className="mb-5 rounded-2xl border border-[var(--bi-ring)] bg-[var(--bi-surface)]"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--bi-ink-3)]">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Filtros
        </span>

        {/* periodo: siempre a la vista, es el que más se usa */}
        {soportaPeriodo ? (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Periodo">
            {PERIODOS_FILTRO.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onCambiar({ ...filtros, periodo: p.key })}
                aria-pressed={filtros.periodo === p.key}
                className={cn(
                  "min-h-8 rounded-lg px-2.5 text-[12px] font-medium transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
                  filtros.periodo === p.key
                    ? "bg-[var(--bi-surface-2)] text-[var(--bi-ink)]"
                    : "text-[var(--bi-ink-3)] hover:text-[var(--bi-ink-2)]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[12px] text-[var(--bi-ink-3)]">
            {notaPeriodo ?? "Esta pantalla no se filtra por periodo."}
          </span>
        )}

        <span className="ml-auto flex items-center gap-2">
          {activos > 0 ? (
            <button
              type="button"
              onClick={onLimpiar}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-[var(--bi-ink-3)] transition-colors hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
            >
              <X className="size-3.5" aria-hidden />
              Quitar {activos === 1 ? "el filtro" : `los ${activos}`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--bi-ring)] px-3 text-[12px] font-medium text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
          >
            Más filtros
            <ChevronDown
              className={cn("size-3.5 transition-transform", abierto && "rotate-180")}
              aria-hidden
            />
          </button>
        </span>
      </div>

      {abierto ? (
        <div className="border-t border-[var(--bi-ring)] px-4 py-4">
          {opciones === undefined ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bi-skeleton h-[58px] rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {opciones.dimensiones.map((d) => (
                  <Selector
                    key={d.key}
                    dim={d}
                    valor={filtros[d.key as DimensionKey]}
                    aplica={soporta.includes(d.key as DimensionKey)}
                    total={opciones.totalRevisiones}
                    onCambiar={(v) =>
                      onCambiar({ ...filtros, [d.key]: v || undefined })
                    }
                  />
                ))}
              </div>

              {opciones.noDisponibles.length > 0 ? (
                <div className="mt-4 space-y-1.5 border-t border-[var(--bi-ring)] pt-3">
                  {opciones.noDisponibles.map((n) => (
                    <p
                      key={n.etiqueta}
                      className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[var(--bi-ink-3)]"
                    >
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>
                        <b className="text-[var(--bi-ink-2)]">{n.etiqueta}</b> no
                        se puede filtrar todavía: {n.motivo}
                      </span>
                    </p>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Resumen de lo aplicado: visible SIEMPRE, también con el panel cerrado.
          Un filtro puesto y escondido es la forma más fácil de leer mal un
          tablero — el número baja y nadie recuerda por qué. */}
      {activos > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--bi-ring)] px-4 py-2.5">
          {filtros.periodo !== "todo" ? (
            <Pastilla
              texto={
                PERIODOS_FILTRO.find((p) => p.key === filtros.periodo)?.label ??
                filtros.periodo
              }
              aplica={soportaPeriodo}
              onQuitar={() => onCambiar({ ...filtros, periodo: "todo" })}
            />
          ) : null}
          {opciones?.dimensiones.map((d) => {
            const v = filtros[d.key as DimensionKey];
            if (!v) return null;
            return (
              <Pastilla
                key={d.key}
                texto={`${d.etiqueta}: ${v}`}
                aplica={soporta.includes(d.key as DimensionKey)}
                onQuitar={() => onCambiar({ ...filtros, [d.key]: undefined })}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Selector({
  dim,
  valor,
  aplica,
  total,
  onCambiar,
}: {
  dim: OpcionesFiltro["dimensiones"][number];
  valor: string | undefined;
  aplica: boolean;
  total: number;
  onCambiar: (v: string) => void;
}) {
  const pierdeFilas = dim.cobertura < total;

  return (
    <div className={cn("min-w-0", !aplica && "opacity-45")}>
      <label className="block">
        <span className="bi-num block text-[10px] uppercase tracking-[0.12em] text-[var(--bi-ink-3)]">
          {dim.etiqueta}
        </span>
        <select
          value={valor ?? ""}
          disabled={!aplica}
          onChange={(e) => onCambiar(e.target.value)}
          className={cn(
            "mt-1 h-9 w-full rounded-lg border border-[var(--bi-ring)] bg-[var(--bi-surface-2)] px-2 text-[13px] text-[var(--bi-ink)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
            "disabled:cursor-not-allowed",
          )}
        >
          <option value="">Todas</option>
          {/* La cuenta al lado del nombre: elegir sin saber cuánto queda es
              elegir a ciegas. */}
          {dim.opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.valor} ({formatInt(o.rows)})
            </option>
          ))}
        </select>
      </label>

      {!aplica ? (
        <p className="mt-1 text-[10.5px] leading-tight text-[var(--bi-ink-3)]">
          No aplica en esta pantalla.
        </p>
      ) : pierdeFilas ? (
        <p className="mt-1 text-[10.5px] leading-tight text-[var(--bi-warn)]">
          {dim.aviso}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Pastilla de filtro aplicado. **Se marca la que no aplica en esta pantalla**
 * en vez de esconderla: el filtro sigue puesto y va a volver a hacer efecto al
 * cambiar de tablero, así que ocultarlo sería una sorpresa esperando.
 */
function Pastilla({
  texto,
  aplica,
  onQuitar,
}: {
  texto: string;
  aplica: boolean;
  onQuitar: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px]",
        aplica
          ? "bg-[var(--bi-income)]/12 text-[var(--bi-income)]"
          : "bg-[var(--bi-surface-2)] text-[var(--bi-ink-3)] line-through",
      )}
      title={aplica ? undefined : "Puesto, pero esta pantalla no lo usa"}
    >
      {texto}
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${texto}`}
        className="rounded-full p-0.5 transition-colors hover:bg-[var(--bi-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}
