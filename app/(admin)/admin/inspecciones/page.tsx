"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useQuery } from "convex/react";
import { RotateCcw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { InspectionTableRow } from "@/components/admin/InspectionTableRow";
import { BiCard } from "@/components/bi/BiCard";
import { formatInt } from "@/lib/bi-format";
import { formatCrc } from "@/lib/admin/inspectionPrice";

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "draft", label: "Borrador" },
  { value: "completed", label: "Completado" },
  { value: "pending_sync", label: "Pendiente sync" },
  { value: "synced", label: "Sincronizado" },
  { value: "report_delivered", label: "Informe entregado" },
] as const;

/** Campos del filtro: altura táctil de 44px y foco visible sobre el grafito. */
const FIELD_CLASS =
  "min-h-11 rounded-xl border border-[var(--bi-ring)] bg-[var(--bi-plane)] px-3 text-sm text-[var(--bi-ink)] transition-colors hover:border-white/16 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]";

const LABEL_CLASS =
  "bi-num grid gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--bi-ink-3)]";

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
          : (status as
              | "draft"
              | "completed"
              | "pending_sync"
              | "synced"
              | "report_delivered"),
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

  const chargedTotal = useMemo(() => {
    if (!rows) return null;
    return rows.reduce((sum, row) => {
      const amount = row.inspection.totalAmountCharged;
      if (amount == null || !Number.isFinite(amount)) return sum;
      return sum + amount;
    }, 0);
  }, [rows]);

  const hasFilters =
    status !== "" || technicianClerkId !== "" || dateFrom !== "" || dateTo !== "";

  return (
    <div>
      <header className="mb-6">
        <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
          Inspecciones
        </h1>
        <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          Vista global con técnico asignado y acceso al PDF
        </p>
      </header>

      <BiCard className="mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <label className={LABEL_CLASS}>
            Estado
            <select
              className={FIELD_CLASS}
              value={status}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                const v = (e.currentTarget as unknown as { value: string }).value;
                setStatus(v);
              }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`${LABEL_CLASS} min-w-[200px]`}>
            Técnico
            <select
              className={FIELD_CLASS}
              value={technicianClerkId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setTechnicianClerkId(
                  (e.currentTarget as unknown as { value: string }).value,
                )
              }
            >
              <option value="">Todos</option>
              {(users ?? []).map((u) => (
                <option key={u._id} value={u.clerkId}>
                  {u.name?.trim() || u.email}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLASS}>
            Desde
            <input
              type="date"
              className={FIELD_CLASS}
              value={dateFrom}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setDateFrom(
                  (e.currentTarget as unknown as { value: string }).value,
                )
              }
            />
          </label>
          <label className={LABEL_CLASS}>
            Hasta
            <input
              type="date"
              className={FIELD_CLASS}
              value={dateTo}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setDateTo(
                  (e.currentTarget as unknown as { value: string }).value,
                )
              }
            />
          </label>
          <button
            type="button"
            disabled={!hasFilters}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--bi-ring)] px-4 text-[13px] font-medium text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] active:scale-[0.98] disabled:opacity-45 disabled:hover:bg-transparent"
            onClick={() => {
              setStatus("");
              setTechnicianClerkId("");
              setDateFrom("");
              setDateTo("");
              setRefresh((n) => n + 1);
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            Limpiar filtros
          </button>
        </div>
      </BiCard>

      {/* `overflow-hidden` para que el pie no asome por las esquinas redondeadas. */}
      <BiCard className="overflow-hidden" bodyClassName="p-0">
        {/* La tabla scrollea en su propio contenedor: el body nunca lo hace. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <caption className="sr-only">
              Inspecciones que cumplen los filtros seleccionados
            </caption>
            <thead>
              <tr className="border-b border-[var(--bi-ring)]">
                {[
                  { label: "Placa / ID", cls: "" },
                  { label: "Vehículo", cls: "hidden sm:table-cell" },
                  { label: "Técnico", cls: "" },
                  { label: "Fecha", cls: "hidden md:table-cell" },
                  { label: "Estado", cls: "" },
                  { label: "Cobrado", cls: "text-right" },
                  { label: "PDF", cls: "text-right" },
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
              {rows === undefined ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-sm text-[var(--bi-ink-3)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center">
                    <span className="block text-sm text-[var(--bi-ink-2)]">
                      No hay inspecciones con estos filtros.
                    </span>
                    <span className="mt-1 block text-xs text-[var(--bi-ink-3)]">
                      Probá ampliar el rango de fechas o limpiar los filtros.
                    </span>
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
        {rows !== undefined ? (
          <div className="flex flex-col gap-1 border-t border-[var(--bi-ring)] bg-[var(--bi-plane)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--bi-ink-3)]">
              {rows.length === 0
                ? "Sin resultados para el filtro actual"
                : `Suma de ${formatInt(rows.length)} inspección${rows.length === 1 ? "" : "es"} del filtro actual`}
            </p>
            <p className="text-[13px] text-[var(--bi-ink-2)]">
              Total cobrado:{" "}
              <span className="bi-num text-base font-semibold text-[var(--bi-ink)]">
                {formatCrc(chargedTotal ?? 0)}
              </span>
            </p>
          </div>
        ) : null}
      </BiCard>
    </div>
  );
}
