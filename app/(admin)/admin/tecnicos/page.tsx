"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TechnicianRow } from "@/components/admin/TechnicianRow";
import { BiCard } from "@/components/bi/BiCard";
import { formatInt } from "@/lib/bi-format";

export default function AdminTecnicosPage() {
  const stats = useQuery(api.admin.getTechniciansWithStats, {});

  const pending = (stats ?? []).filter(
    (r) => r.user.role !== "admin" && r.user.approvalStatus === "pending",
  ).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
          Técnicos y usuarios
        </h1>
        <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          {stats === undefined
            ? "Cargando…"
            : `${formatInt(stats.length)} usuarios · ${formatInt(pending)} pendientes de aprobación`}
        </p>
      </header>

      {/* `overflow-hidden`: la tabla no debe asomar por las esquinas del marco. */}
      <BiCard className="overflow-hidden" bodyClassName="p-0">
        {/* La tabla scrollea en su propio contenedor: el body nunca lo hace. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <caption className="sr-only">
              Usuarios del sistema con su rol, actividad e inspecciones
            </caption>
            <thead>
              <tr className="border-b border-[var(--bi-ring)]">
                {[
                  { label: "Usuario", cls: "" },
                  { label: "Rol", cls: "" },
                  { label: "Inspecciones", cls: "" },
                  /* No es «última vez que entró»: es su revisión más reciente (A151). */
                  { label: "Última revisión", cls: "hidden lg:table-cell" },
                  { label: "Acciones", cls: "text-right" },
                ].map((h) => (
                  <th
                    key={h.label}
                    scope="col"
                    className={`bi-num px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--bi-ink-3)] ${h.cls}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats === undefined ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-10 text-center text-sm text-[var(--bi-ink-3)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : stats.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-10 text-center text-sm text-[var(--bi-ink-2)]"
                  >
                    Todavía no hay usuarios registrados.
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
      </BiCard>
    </div>
  );
}
