"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InspectionTableRow } from "@/components/admin/InspectionTableRow";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "draft", label: "Borrador" },
  { value: "completed", label: "Completado" },
  { value: "pending_sync", label: "Pendiente sync" },
  { value: "synced", label: "Sincronizado" },
] as const;

export default function AdminInspeccionesPage() {
  const [status, setStatus] = useState<string>("");
  const [technicianClerkId, setTechnicianClerkId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [refresh, setRefresh] = useState(0);

  const users = useQuery(api.users.list, {});

  const listArgs = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom).getTime() : undefined;
    const to = dateTo ? new Date(dateTo).getTime() + 86400000 - 1 : undefined;
    return {
      status:
        status === ""
          ? undefined
          : (status as "draft" | "completed" | "pending_sync" | "synced"),
      technicianClerkId: technicianClerkId || undefined,
      dateFrom: from,
      dateTo: to,
      limit: 150,
      refresh,
    };
  }, [status, technicianClerkId, dateFrom, dateTo, refresh]);

  const rows = useQuery(api.admin.listAllInspections, listArgs);

  const pdfBatch = useQuery(
    api.pdfs.getPdfStatusBatch,
    rows && rows.length > 0
      ? { inspectionIds: rows.map((r) => r.inspection._id) }
      : "skip",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Todas las inspecciones</h1>
        <p className="text-sm text-muted-foreground">
          Vista global con técnico asignado y acceso a PDF.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm md:flex-row md:flex-wrap md:items-end">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Estado
          <select
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-[200px] gap-1 text-xs font-medium text-muted-foreground">
          Técnico
          <select
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={technicianClerkId}
            onChange={(e) => setTechnicianClerkId(e.target.value)}
          >
            <option value="">Todos</option>
            {(users ?? []).map((u) => (
              <option key={u._id} value={u.clerkId}>
                {u.name?.trim() || u.email}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Desde
          <input
            type="date"
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Hasta
          <input
            type="date"
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => {
            setStatus("");
            setTechnicianClerkId("");
            setDateFrom("");
            setDateTo("");
            setRefresh((n) => n + 1);
          }}
        >
          Limpiar filtros
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">Placa / ID</th>
                <th className="hidden px-3 py-3 sm:table-cell">Vehículo</th>
                <th className="px-3 py-3">Técnico</th>
                <th className="hidden px-3 py-3 md:table-cell">Fecha</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows === undefined ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Cargando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No hay inspecciones con estos filtros.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <InspectionTableRow
                    key={row.inspection._id}
                    inspection={row.inspection}
                    technicianName={row.technicianName}
                    pdfInfo={
                      pdfBatch
                        ? (pdfBatch[String(row.inspection._id)] ?? null)
                        : null
                    }
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
