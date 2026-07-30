"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

/**
 * Portada del panel admin. Solo capa de datos: lee `admin:getDashboardMetrics`
 * (que exige rol admin en el backend) y delega el diseño a `AdminDashboard`.
 * El fondo grafito lo aplica el shell (`AdminAppShell`).
 */
export default function AdminDashboardPage() {
  const metrics = useQuery(api.admin.getDashboardMetrics, {});

  if (metrics === undefined) {
    return (
      <div>
        <div className="bi-skeleton h-9 w-64 rounded-lg" />
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

  return <AdminDashboard metrics={metrics} />;
}
