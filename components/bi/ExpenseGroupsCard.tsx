"use client";

import { TriangleAlert } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import { BiCategoryBars } from "@/components/bi/BiCategoryBars";
import { formatCRC, formatPct } from "@/lib/bi-format";

export type ExpenseBreakdown = {
  totalCRC: number;
  totalRows: number;
  grupos: Array<{ grupo: string; rows: number; amountCRC: number; pct: number }>;
  sinClasificar: Array<{ etiqueta: string; rows: number; amountCRC: number }>;
};

/** Nombres para mostrar. Los internos son claves; estos son los de Esteban. */
const NOMBRES: Record<string, string> = {
  servicios_profesionales: "Servicios profesionales",
  software: "Software y herramientas",
  viaticos_tecnico: "Viáticos del técnico",
  equipo: "Equipo",
  telefonia: "Telefonía",
  desarrollo_panel: "Desarrollo del panel",
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

  // `BiCategoryBars` traduce su `category` con `categoryLabel`, que devuelve la
  // clave tal cual si no la conoce. Los grupos NO son categorías de finanzas, así
  // que no se meten en ese diccionario: se le pasa el nombre ya traducido.
  const rows = clasificados.map((g) => ({
    category: NOMBRES[g.grupo] ?? g.grupo,
    amountCRC: g.amountCRC,
  }));

  return (
    <BiCard
      title="Qué hay adentro de «Otros»"
      subtitle={`${formatCRC(data.totalCRC)} en ${data.totalRows} movimientos`}
    >
      <BiCategoryBars rows={rows} tone="expense" />

      <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-xs text-[var(--bi-ink-3)]">
        Es la misma plata, agrupada — no cambia la utilidad. Los grupos salen del
        renglón con que cada gasto entró desde la hoja.
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
                  ({formatPct(sinClasificar.pct)} de «Otros»)
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
