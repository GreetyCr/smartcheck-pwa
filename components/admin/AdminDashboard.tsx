"use client";

import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  CloudCheck,
  CloudUpload,
  FileText,
  Send,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { BiCard } from "@/components/bi/BiCard";
import { BiKpiCard } from "@/components/bi/BiKpiCard";
import { formatInt } from "@/lib/bi-format";
import { cn } from "@/lib/utils";

/**
 * Portada del panel admin — capa 100% presentacional (recibe las métricas ya
 * resueltas, igual que `FinanceDashboard`). Eso permite renderizarla con datos
 * de muestra en `app/dev/admin` sin sesión ni Convex.
 *
 * El tipo se deriva de la query para que no pueda desincronizarse del backend:
 * si `getDashboardMetrics` cambia su forma, esto falla en `tsc`.
 */
export type AdminMetrics = FunctionReturnType<
  typeof api.admin.getDashboardMetrics
>;

/** Alto en px del área de trazado de las barras diarias (encoding lineal). */
const PLOT_H = 210;
/** Banda reservada arriba para el rótulo numérico de cada barra. */
const VALUE_H = 18;
/** Alto reservado a la fila de etiquetas de día (para anclar la línea base). */
const LABEL_H = 16;

export function AdminDashboard({ metrics }: { metrics: AdminMetrics }) {
  const {
    todayCount,
    monthCount,
    pendingSyncCount,
    totalInspections,
    techniciansCount,
    activeTechnicians,
    last7Days,
    byTechnician,
    byStatus,
  } = metrics;

  const week = last7Days.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      {/* ---------- encabezado ---------- */}
      <header className="mb-6">
        <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
          Resumen general
        </h1>
        <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          {formatInt(totalInspections)} inspecciones en sistema ·{" "}
          {formatInt(techniciansCount)} técnicos registrados
        </p>
      </header>

      {/* ---------- KPIs ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BiKpiCard
          index={0}
          label="Inspecciones hoy"
          tone="income"
          value={formatInt(todayCount)}
          hint={`${formatInt(week)} en 7 días`}
        />
        <BiKpiCard
          index={1}
          label="Este mes"
          tone="utilidad"
          value={formatInt(monthCount)}
          hint={`${formatInt(totalInspections)} acumuladas`}
        />
        <BiKpiCard
          index={2}
          label="Sin sincronizar"
          tone="warn"
          value={formatInt(pendingSyncCount)}
          // Pista corta a propósito: en 375px la tarjeta trunca lo que no cabe.
          hint={pendingSyncCount > 0 ? "Esperan subida" : "Todo al día"}
        />
        <BiKpiCard
          index={3}
          label="Técnicos activos (mes)"
          tone="neutral"
          value={formatInt(activeTechnicians)}
          hint={`de ${formatInt(techniciansCount)} registrados`}
        />
      </div>

      {/* ---------- actividad ---------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <BiCard
          title="Inspecciones por día"
          subtitle="Últimos 7 días, incluido hoy"
        >
          <DailyBars days={last7Days} />
        </BiCard>

        <BiCard
          title="Inspecciones por técnico"
          subtitle="Acumulado histórico"
        >
          <TechnicianBars rows={byTechnician} />
        </BiCard>
      </div>

      {/* ---------- estado del inventario de inspecciones ---------- */}
      <div className="mt-4">
        <BiCard
          title="Estado de las inspecciones"
          subtitle="Todo el histórico"
          action={
            <span className="bi-num shrink-0 text-xs text-[var(--bi-ink-3)]">
              {formatInt(totalInspections)} en total
            </span>
          }
        >
          <StatusGrid byStatus={byStatus} total={totalInspections} />
        </BiCard>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Barras verticales de una sola serie (inspecciones) → sin leyenda: el título
 * la nombra. Rótulo numérico directo sobre cada barra en vez de rejilla: con 7
 * marcas y valores enteros pequeños, el eje de valor sería redundante.
 *
 * El área de trazado es de **alto fijo en px** y la altura de cada barra se
 * calcula sobre `PLOT_H - VALUE_H`: si se usaran porcentajes, el rótulo de
 * arriba comprimiría las barras y el encoding dejaría de ser lineal.
 */
function DailyBars({ days }: { days: { dayLabel: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const barMax = PLOT_H - VALUE_H;

  return (
    <div className="relative">
      {/* línea base anclada justo encima de la fila de etiquetas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-px bg-[var(--bi-axis)]"
        style={{ bottom: LABEL_H }}
      />
      <ul className="relative flex items-end gap-1.5 sm:gap-2">
        {days.map((d, i) => {
          const h = d.count > 0 ? Math.max(3, (d.count / max) * barMax) : 2;
          return (
            <li
              key={d.dayLabel}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <span className="sr-only">
                {d.dayLabel}: {formatInt(d.count)} inspecciones
              </span>
              {/* El rótulo viaja pegado a su barra (no en una fila fija arriba):
                  con barras cortas, un número lejano no se asocia a nada. */}
              <span
                aria-hidden
                className="flex w-full flex-col items-center justify-end"
                style={{ height: PLOT_H }}
              >
                <span
                  className={cn(
                    "bi-num mb-1 shrink-0 text-[11px] leading-none",
                    d.count > 0
                      ? "text-[var(--bi-ink-2)]"
                      : "text-[var(--bi-ink-3)]",
                  )}
                >
                  {d.count > 0 ? formatInt(d.count) : "—"}
                </span>
                <span
                  className="bi-rise w-full max-w-[36px] shrink-0 rounded-t-[4px]"
                  style={{
                    height: h,
                    background:
                      d.count > 0 ? "var(--bi-income)" : "var(--bi-grid)",
                    animationDelay: `${i * 45}ms`,
                  }}
                />
              </span>
              <span
                aria-hidden
                className="bi-num w-full truncate text-center text-[10px] leading-4 text-[var(--bi-ink-3)]"
                style={{ height: LABEL_H }}
              >
                {d.dayLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Ranking por técnico. Mismo hue que las barras diarias porque es la **misma
 * entidad** (inspecciones) vista por otra dimensión: el color sigue al dato, no
 * a la fila. Scroll propio para que la tarjeta no crezca sin control.
 */
function TechnicianBars({
  rows,
}: {
  rows: { clerkId: string; name: string; count: number }[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-[var(--bi-ink-3)]">
        Todavía no hay técnicos registrados.
      </p>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <ul className="max-h-[264px] space-y-3 overflow-y-auto pr-1">
      {rows.map((r, i) => (
        <li key={r.clerkId}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] text-[var(--bi-ink-2)]">
              {r.name}
            </span>
            <span className="bi-num shrink-0 text-[13px] text-[var(--bi-ink)]">
              {formatInt(r.count)}
            </span>
          </div>
          <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
            <div
              className="bi-grow-x h-full rounded-full"
              style={{
                width: `${r.count > 0 ? Math.max((r.count / max) * 100, 2) : 0}%`,
                background: "var(--bi-income)",
                animationDelay: `${i * 50}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Reparto por estado.
 *
 * A propósito **sin codificar el estado por color**: la paleta validada tiene
 * dos series categóricas (`--bi-income`/`--bi-expense`) y tres de estado, y acá
 * hacen falta cinco categorías. Inventar tres hues rompería la validación, así
 * que cada estado se identifica por icono + rótulo y solo el accionable
 * ("Pendiente sync") se resalta con `--bi-warn`.
 */
function StatusGrid({
  byStatus,
  total,
}: {
  byStatus: AdminMetrics["byStatus"];
  total: number;
}) {
  const items: {
    key: keyof AdminMetrics["byStatus"];
    label: string;
    Icon: LucideIcon;
    /** Estado que pide acción del admin. */
    actionable?: boolean;
  }[] = [
    { key: "draft", label: "Borrador", Icon: FileText },
    { key: "completed", label: "Completado", Icon: CheckCircle2 },
    {
      key: "pending_sync",
      label: "Pendiente sync",
      Icon: CloudUpload,
      actionable: true,
    },
    { key: "synced", label: "Sincronizado", Icon: CloudCheck },
    { key: "report_delivered", label: "Informe entregado", Icon: Send },
  ];

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ key, label, Icon, actionable }, i) => {
        const count = byStatus[key];
        const warn = actionable === true && count > 0;
        const share = total > 0 ? (count / total) * 100 : 0;
        return (
          <li
            key={key}
            className="bi-fade-up rounded-xl border border-[var(--bi-ring)] bg-[var(--bi-plane)] p-3"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <span className="flex items-start gap-1.5">
              <Icon
                className="mt-px size-3.5 shrink-0"
                style={{
                  color: warn ? "var(--bi-warn)" : "var(--bi-ink-3)",
                }}
                aria-hidden
              />
              {/* Se deja envolver en vez de truncar: "Informe entregado" no cabe
                  en una línea a 375px y un rótulo cortado no dice nada. */}
              <span className="text-[11px] leading-tight text-[var(--bi-ink-2)]">
                {label}
              </span>
            </span>
            <span className="mt-1.5 flex items-baseline gap-1.5">
              <span
                className="bi-num text-[20px] font-semibold leading-none"
                style={{
                  color: warn ? "var(--bi-warn)" : "var(--bi-ink)",
                }}
              >
                {formatInt(count)}
              </span>
              <span className="bi-num text-[10px] text-[var(--bi-ink-3)]">
                {/* `0%` mentiría cuando hay 1 de 800: se muestra `<1%`. */}
                {share > 0 && share < 1 ? "<1%" : `${share.toFixed(0)}%`}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
