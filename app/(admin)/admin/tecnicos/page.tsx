"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TechnicianRow } from "@/components/admin/TechnicianRow";

export default function AdminTecnicosPage() {
  const stats = useQuery(api.admin.getTechniciansWithStats, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Técnicos y usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Roles, actividad e inspecciones por persona.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">Usuario</th>
                <th className="px-3 py-3">Rol</th>
                <th className="px-3 py-3">Inspecciones</th>
                <th className="hidden px-3 py-3 lg:table-cell">Última actividad</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {stats === undefined ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : stats.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    No hay usuarios.
                  </td>
                </tr>
              ) : (
                stats.map((row) => (
                  <TechnicianRow
                    key={row.user._id}
                    user={row.user}
                    inspectionCount={row.inspectionCount}
                    lastActivityAt={row.lastActivityAt}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
