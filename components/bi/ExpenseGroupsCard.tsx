"use client";

import { TriangleAlert } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import { formatCRC, formatPct } from "@/lib/bi-format";
import { categoryLabel } from "@/lib/bi-format";

export type EtiquetaGrupo = { etiqueta: string; rows: number; amountCRC: number };

export type ExpenseBreakdown = {
  categorias: string[];
  totalCRC: number;
  totalRows: number;
  grupos: Array<{
    grupo: string;
    rows: number;
    amountCRC: number;
    pct: number;
    etiquetas: EtiquetaGrupo[];
  }>;
  sinClasificar: EtiquetaGrupo[];
};

/** Nombres para mostrar. Los internos son claves; estos son los de Esteban. */
const NOMBRES: Record<string, string> = {
  servicios_profesionales: "Servicios profesionales",
  software: "Software y herramientas",
  viaticos_tecnico: "Viáticos del técnico",
  equipo: "Equipo",
  telefonia: "Telefonía",
  sin_clasificar: "Sin clasificar",
};

/**
 * Qué hay adentro de «Otros» (A61 · A83).
 *
 * El problema que resuelve: «Otros» se lleva casi un tercio del gasto, y un
 * tercio de la plata en una bolsa sin nombre no sirve para decidir nada.
 *
 * **«Sin clasificar» se muestra aparte y con nombre y apellido**, no mezclado
 * entre los demás grupos. Es a propósito: si apareciera como una barra más,
 * volvería a ser una bolsa anónima — justo lo que esta tarjeta existe para
 * eliminar. Acá se lista **qué proveedor** falta acomodar y cuánto pesa, que es
 * lo único accionable.
 */
export function ExpenseGroupsCard({ data }: { data: ExpenseBreakdown }) {
  if (data.totalRows === 0) return null;

  const clasificados = data.grupos.filter((g) => g.grupo !== "sin_clasificar");
  const sinClasificar = data.grupos.find((g) => g.grupo === "sin_clasificar");
  const max = Math.max(1, ...clasificados.map((g) => g.amountCRC));

  return (
    <BiCard
      title="En qué se va el gasto"
      subtitle={`${formatCRC(data.totalCRC)} en ${data.totalRows} movimientos · ${data.categorias
        .map((c) => categoryLabel(c))
        .join(" + ")}`}
    >
      <ul className="space-y-4">
        {clasificados.map((g, i) => (
          <li key={g.grupo}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[14px] font-medium text-[var(--bi-ink)]">
                {NOMBRES[g.grupo] ?? g.grupo}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="bi-num text-[14px] tabular-nums text-[var(--bi-ink)]">
                  {formatCRC(g.amountCRC)}
                </span>
                <span className="bi-num text-[11px] tabular-nums text-[var(--bi-ink-3)]">
                  {formatPct(g.pct)}
                </span>
              </span>
            </div>

            <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
              <div
                className="bi-grow-x h-full rounded-full"
                style={{
                  width: `${Math.max((g.amountCRC / max) * 100, 2)}%`,
                  background: "var(--bi-expense)",
                  animationDelay: `${i * 50}ms`,
                }}
              />
            </div>

            {/* Los proveedores del grupo. Es lo que pidió Esteban: sin esto,
                «servicios profesionales» dice ₡6,7 M y no dice de quién. */}
            <ul className="mt-2 space-y-1 border-l border-[var(--bi-ring)] pl-3">
              {g.etiquetas.map((e) => (
                <li
                  key={e.etiqueta}
                  className="flex items-baseline justify-between gap-3 text-[12.5px]"
                >
                  <span className="min-w-0 truncate text-[var(--bi-ink-3)]">
                    {e.etiqueta}
                    {e.rows > 1 ? <span className="opacity-70"> ×{e.rows}</span> : null}
                  </span>
                  <span className="bi-num shrink-0 tabular-nums text-[var(--bi-ink-2)]">
                    {formatCRC(e.amountCRC)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-xs leading-relaxed text-[var(--bi-ink-3)]">
        Es la misma plata, agrupada — no cambia la utilidad. Cada proveedor sale
        del renglón con que el gasto entró, así que el total de acá no es el de
        una sola categoría del gráfico de arriba.
      </p>

      {sinClasificar ? (
        <div className="mt-3 rounded-xl border border-[var(--bi-expense)]/35 bg-[var(--bi-expense)]/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-[var(--bi-expense)]"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--bi-ink)]">
                {formatCRC(sinClasificar.amountCRC)} sin clasificar
                <span className="ml-1 font-normal text-[var(--bi-ink-3)]">
                  ({formatPct(sinClasificar.pct)} del total)
                </span>
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--bi-ink-2)]">
                Son gastos cuyo renglón todavía no sabemos en qué grupo va.
                Decinos dónde los ponés y los acomodamos:
              </p>
              <ul className="mt-2 space-y-1">
                {data.sinClasificar.map((s) => (
                  <li
                    key={s.etiqueta}
                    className="flex items-baseline justify-between gap-3 text-[12.5px]"
                  >
                    <span className="truncate text-[var(--bi-ink-2)]">
                      {s.etiqueta}
                      {s.rows > 1 ? (
                        <span className="text-[var(--bi-ink-3)]"> ×{s.rows}</span>
                      ) : null}
                    </span>
                    <span className="bi-num shrink-0 tabular-nums text-[var(--bi-ink)]">
                      {formatCRC(s.amountCRC)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </BiCard>
  );
}
