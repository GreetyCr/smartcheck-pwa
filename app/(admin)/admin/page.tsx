"use client";

import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Clock,
  Users,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MetricCard } from "@/components/admin/MetricCard";

export default function AdminDashboardPage() {
  const metrics = useQuery(api.admin.getDashboardMetrics, {});

  if (metrics === undefined) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-48 rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const maxBar = Math.max(1, ...metrics.last7Days.map((d) => d.count));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen global de inspecciones y equipo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Inspecciones hoy"
          value={metrics.todayCount}
          icon={ClipboardList}
          variant="blue"
        />
        <MetricCard
          title="Este mes"
          value={metrics.monthCount}
          icon={CalendarDays}
          variant="green"
        />
        <MetricCard
          title="Pendientes de sync"
          value={metrics.pendingSyncCount}
          icon={Clock}
          variant="yellow"
        />
        <MetricCard
          title="Técnicos activos (mes)"
          value={metrics.activeTechnicians}
          subtitle={`${metrics.techniciansCount} registrados`}
          icon={Users}
          variant="purple"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
            <BarChart3 className="size-4" aria-hidden />
            Últimos 7 días
          </h2>
          <div className="flex h-44 items-end justify-between gap-2">
            {metrics.last7Days.map((d) => (
              <div
                key={d.dayLabel}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
              >
                <div
                  className="flex w-full max-w-[3rem] flex-1 flex-col justify-end"
                  title={`${d.count}`}
                >
                  <div
                    className="w-full rounded-t-md bg-[#1E3A5F]/85 transition-all"
                    style={{
                      height: `${(d.count / maxBar) * 100}%`,
                      minHeight: d.count > 0 ? "8px" : "2px",
                    }}
                  />
                </div>
                <span className="max-w-full truncate text-center text-[10px] text-muted-foreground">
                  {d.dayLabel}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[#1E3A5F]">
            Por técnico (total)
          </h2>
          <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
            {metrics.byTechnician.length === 0 ? (
              <li className="text-muted-foreground">Sin datos.</li>
            ) : (
              metrics.byTechnician.map((t) => (
                <li
                  key={t.clerkId}
                  className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 last:border-0"
                >
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t.count}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-[#1E3A5F]">
          Distribución por estado
        </h2>
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-900">
            Borrador: {metrics.byStatus.draft}
          </span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-900">
            Completado: {metrics.byStatus.completed}
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
            Pendiente sync: {metrics.byStatus.pending_sync}
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">
            Sincronizado: {metrics.byStatus.synced}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Total en sistema:{" "}
          <strong className="text-foreground">{metrics.totalInspections}</strong>
        </p>
      </section>
    </div>
  );
}
