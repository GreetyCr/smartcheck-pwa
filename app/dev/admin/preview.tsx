"use client";

import {
  AdminDashboard,
  type AdminMetrics,
} from "@/components/admin/AdminDashboard";
import { DevAdminShell } from "./shell";

/**
 * Datos de MUESTRA (no salen de Convex) con magnitudes creíbles para juzgar el
 * diseño. Fijos: la vista debe verse igual en cada carga.
 *
 * El tipo es el de la query real (`AdminMetrics`), así que si el backend cambia
 * de forma esta muestra deja de compilar en vez de mentir.
 */
const METRICS: AdminMetrics = {
  todayCount: 4,
  monthCount: 47,
  pendingSyncCount: 3,
  totalInspections: 812,
  techniciansCount: 6,
  activeTechnicians: 4,
  last7Days: [
    { dayLabel: "jue 23", count: 6 },
    { dayLabel: "vie 24", count: 9 },
    { dayLabel: "sáb 25", count: 3 },
    { dayLabel: "dom 26", count: 0 },
    { dayLabel: "lun 27", count: 7 },
    { dayLabel: "mar 28", count: 11 },
    { dayLabel: "mié 29", count: 4 },
  ],
  byTechnician: [
    { clerkId: "u1", name: "Esteban Vargas", count: 214 },
    { clerkId: "u2", name: "Técnico 2", count: 168 },
    { clerkId: "u3", name: "Técnico 3", count: 141 },
    { clerkId: "u4", name: "Kevin Solano", count: 96 },
    { clerkId: "u5", name: "María Fernández", count: 52 },
    { clerkId: "u6", name: "Técnico 6", count: 11 },
  ],
  byStatus: {
    draft: 38,
    completed: 122,
    pending_sync: 3,
    synced: 214,
    report_delivered: 435,
  },
};

export function AdminShellPreview() {
  return (
    <DevAdminShell activePath="/admin">
      <AdminDashboard metrics={METRICS} />
    </DevAdminShell>
  );
}
