"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useQuery } from "convex/react";
import { RotateCcw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { InspectionTableRow } from "@/components/admin/InspectionTableRow";
import { BiCard } from "@/components/bi/BiCard";
import { formatInt } from "@/lib/bi-format";
import { formatCrc } from "@/lib/admin/inspectionPrice";
import {
  FiltrosGlobales,
  useFiltrosBi,
} from "@/components/bi/FiltrosGlobales";
import { InspeccionesResumen } from "@/components/bi/InspeccionesResumen";

/**
 * Las ocho dimensiones de la barra global. Esta pantalla las honra todas porque
 * el resumen de arriba lee la **vista unificada**, igual que la portada.
 *
 * Los filtros de la tabla de abajo (estado, técnico, fechas) son otra cosa y se
 * quedan donde están: son operativos, existen solo del lado app y sirven para
 * encontrar **una** revisión, no para medir. Mezclarlos en la barra global los
 * pondría en pantallas donde esas columnas no existen. Cada bloque dice qué
 * filtro lo gobierna.
 */
const SOPORTA = [
  "periodo",
  "channel",
  "province",
  "engineType",
  "agency",
  "brand",
  "sellerType",
  "currency",
] as const;

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

  const { args: filtrosGlobales } = useFiltrosBi(SOPORTA);
  const panel = useQuery(api.bi.public.inspecciones, filtrosGlobales);

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
      limit: 400,
      refresh,
    };
  }, [status, technicianClerkId, dateFrom, dateTo, refresh]);

  const listado = useQuery(api.admin.listAllInspections, listArgs);
  const rows = listado?.rows;

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
          Total histórico, desglose por mes y quién las hizo
        </p>
      </header>

      <div className="mb-4">
        <FiltrosGlobales soporta={SOPORTA} />
      </div>

      {panel === undefined ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bi-skeleton h-[110px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <InspeccionesResumen panel={panel} />
      )}

      {/* De acá para abajo manda otro filtro, y hay que decirlo: la tabla lista
          solo lo que se hizo en la app —es la única con estado y PDF— y se
          gobierna con sus propios controles, no con la barra de arriba. */}
      <h2 className="bi-display mb-3 mt-8 text-[18px] font-bold uppercase leading-none text-[var(--bi-ink)]">
        Detalle de las hechas en la app
      </h2>
      <p className="mb-3 text-[13px] text-[var(--bi-ink-2)]">
        Una fila por revisión, con su estado y su PDF. Esta tabla{" "}
        <strong>no usa la barra de filtros de arriba</strong>: tiene los suyos,
        porque el estado y el técnico solo existen del lado app.
      </p>

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
              {listado === undefined || rows.length === 0
                ? "Sin resultados para el filtro actual"
                : listado.truncated
                  ? /* Antes decía el largo de lo que recibía, que con el tope
                       puesto no era el total sino el tope. Ahora dice las dos
                       cosas: cuántas hay y cuántas se están pintando. */
                    `${formatInt(listado.totalMatched)} inspecciones con este filtro · se muestran las ${formatInt(rows.length)} más recientes`
                  : `${formatInt(listado.totalMatched)} inspección${listado.totalMatched === 1 ? "" : "es"} con este filtro`}
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
