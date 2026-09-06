"use client";

import { useMemo, useState } from "react";
import { Lock, RotateCcw } from "lucide-react";
import {
  formatCRC,
  formatInt,
  formatIsoDateCR,
  formatPhone8,
} from "@/lib/bi-format";
import { cn } from "@/lib/utils";
import { BiCard } from "./BiCard";
import { BiPager } from "./BiPager";
import type { ConvertedLead } from "./types";

const PAGE_SIZE = 20;

/** El origen de la revisión con la que cruzó, en palabras y no en códigos. */
const ORIGENES = [
  { value: "todos" as const, label: "Todos" },
  { value: "era_app" as const, label: "Revisión hecha en la app" },
  { value: "legacy" as const, label: "CRM histórico" },
];

const THEAD =
  "bi-num px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--bi-ink-3)]";

/**
 * La lista completa de quienes convirtieron, consultable.
 *
 * Antes eran 12 filas sin forma de ver el resto. Se pagina y se filtra **del
 * lado del cliente** a propósito: con unos cientos de filas —299 al
 * 6-set-2026— ir al servidor por cada página agrega latencia y no ahorra nada.
 *
 * El resumen del paginador siempre dice cuántas filas se ven, cuántas quedaron
 * tras el filtro y cuántas hay en total. Sin eso, un filtro puesto se confunde
 * con "hay menos convertidos", que es exactamente el error que este tablero no
 * se puede permitir.
 *
 * Son nombres y teléfonos de clientes reales: solo-admin, y no salen a consola
 * ni a ningún log.
 */
export function ConvertedLeadsCard({ rows }: { rows: ConvertedLead[] }) {
  const [desdeFecha, setDesdeFecha] = useState("");
  const [hastaFecha, setHastaFecha] = useState("");
  const [origen, setOrigen] = useState<"todos" | "era_app" | "legacy">("todos");
  const [page, setPage] = useState(1);

  // Las fechas vienen como "YYYY-MM-DD" en zona CR, así que comparar strings
  // es comparar fechas — sin `Date`, sin husos horarios, sin sorpresas.
  const limites = useMemo(() => {
    const fechas = rows
      .map((r) => r.inspectionDate)
      .filter((d): d is string => !!d)
      .sort();
    return { min: fechas[0], max: fechas[fechas.length - 1] };
  }, [rows]);

  const sinFecha = useMemo(
    () => rows.filter((r) => !r.inspectionDate).length,
    [rows],
  );

  const hayFiltro = desdeFecha !== "" || hastaFecha !== "" || origen !== "todos";

  const filtradas = useMemo(
    () =>
      rows.filter((r) => {
        if (origen !== "todos" && r.matchTarget !== origen) return false;
        if (desdeFecha || hastaFecha) {
          // Una fila sin fecha no puede afirmar que cae dentro del rango, así
          // que se excluye. La tarjeta avisa cuántas son cuando existen.
          if (!r.inspectionDate) return false;
          if (desdeFecha && r.inspectionDate < desdeFecha) return false;
          if (hastaFecha && r.inspectionDate > hastaFecha) return false;
        }
        return true;
      }),
    [rows, origen, desdeFecha, hastaFecha],
  );

  const pageCount = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const desde = (pageSafe - 1) * PAGE_SIZE;
  const visibles = filtradas.slice(desde, desde + PAGE_SIZE);

  const limpiar = () => {
    setDesdeFecha("");
    setHastaFecha("");
    setOrigen("todos");
    setPage(1);
  };

  const campo =
    "rounded-xl border border-[var(--bi-ring)] bg-[var(--bi-plane)] px-3 py-2 text-[13px] text-[var(--bi-ink)] outline-none transition-colors focus:border-[var(--bi-income)] focus:ring-2 focus:ring-[var(--bi-income)]/30";

  return (
    <BiCard
      className="min-w-0"
      title="Quiénes convirtieron"
      subtitle={`${formatInt(rows.length)} leads con una revisión pagada`}
      bodyClassName="pt-0"
      action={
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-[var(--bi-ink-3)]">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          Solo administración
        </span>
      }
    >
      {/* Los filtros van arriba de lo único que filtran —esta tabla— para que
          nadie crea que también mueven los indicadores de la portada. */}
      <div className="flex flex-wrap items-end gap-3 pb-4 pt-4">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label
              htmlFor="conv-desde"
              className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--bi-ink-3)]"
            >
              Desde
            </label>
            <input
              id="conv-desde"
              type="date"
              value={desdeFecha}
              min={limites.min}
              max={limites.max}
              onChange={(e) => {
                setDesdeFecha(e.target.value);
                setPage(1);
              }}
              className={cn(campo, "bi-num mt-1.5")}
            />
          </div>
          <div>
            <label
              htmlFor="conv-hasta"
              className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--bi-ink-3)]"
            >
              Hasta
            </label>
            <input
              id="conv-hasta"
              type="date"
              value={hastaFecha}
              min={desdeFecha || limites.min}
              max={limites.max}
              onChange={(e) => {
                setHastaFecha(e.target.value);
                setPage(1);
              }}
              className={cn(campo, "bi-num mt-1.5")}
            />
          </div>
        </div>

        <div
          role="group"
          aria-label="Filtrar por origen de la revisión"
          className="flex flex-wrap items-center gap-1.5"
        >
          {ORIGENES.map((o) => {
            const active = origen === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setOrigen(o.value);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
                  active
                    ? "border-[var(--bi-income)] bg-[var(--bi-income)]/12 text-[var(--bi-ink)]"
                    : "border-[var(--bi-ring)] text-[var(--bi-ink-3)] hover:text-[var(--bi-ink-2)]",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {hayFiltro ? (
          <button
            type="button"
            onClick={limpiar}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--bi-ring)] px-3 py-2 text-xs font-medium text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Quitar filtros
          </button>
        ) : null}
      </div>

      {filtradas.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--bi-ink-2)]">
          {rows.length === 0
            ? "Todavía no hay ningún lead emparejado con una revisión pagada."
            : `Ningún convertido cae en este filtro. Los ${formatInt(rows.length)} siguen ahí: quitá el filtro para verlos.`}
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">
              Leads con una revisión pagada, con su teléfono, la fecha de la
              revisión, el monto y la confianza del emparejamiento
            </caption>
            <thead>
              <tr className="border-b border-[var(--bi-ring)]">
                {["Cliente", "Teléfono", "Revisión", "Monto", "Confianza"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className={cn(THEAD, h === "Monto" && "text-right")}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visibles.map((s, i) => (
                <tr
                  key={`${s.phone8 ?? "s"}-${s.inspectionDate ?? ""}-${desde + i}`}
                  className="border-b border-[var(--bi-ring)]/60 transition-colors last:border-0 hover:bg-[var(--bi-surface-2)]"
                >
                  <td className="px-4 py-3 text-[13px] text-[var(--bi-ink)]">
                    {s.leadName?.trim() || (
                      <span className="text-[var(--bi-ink-3)]">Sin nombre</span>
                    )}
                  </td>
                  <td className="bi-num whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-[var(--bi-ink-2)]">
                    {s.phone8 ? formatPhone8(s.phone8) : "—"}
                  </td>
                  <td className="bi-num whitespace-nowrap px-4 py-3 text-[13px] text-[var(--bi-ink-2)]">
                    {s.inspectionDate ? formatIsoDateCR(s.inspectionDate) : "—"}{" "}
                    {/* El espacio no es cosmético: sin él, el lector de pantalla
                        lee "29 mar 2026histórico" de corrido. */}
                    <span className="ml-2 text-[var(--bi-ink-3)]">
                      {s.matchTarget === "era_app" ? "app" : "histórico"}
                    </span>
                  </td>
                  <td className="bi-num whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums text-[var(--bi-ink)]">
                    {s.amountCRC != null ? formatCRC(s.amountCRC) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {/* Relleno + rótulo, nunca solo color (A48). */}
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full border border-[var(--bi-income)]/60 px-2 py-0.5 text-[11px] font-medium",
                        s.confidenceBand === "alta"
                          ? "bg-[var(--bi-income)]/15 text-[var(--bi-ink)]"
                          : "text-[var(--bi-ink-2)]",
                      )}
                    >
                      {s.confidenceBand === "alta" ? "Alta" : "Media"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BiPager
        page={pageSafe}
        pageCount={pageCount}
        onChange={setPage}
        summary={
          filtradas.length === 0
            ? `0 de ${formatInt(rows.length)} en total`
            : hayFiltro
              ? `Mostrando ${formatInt(desde + 1)}–${formatInt(desde + visibles.length)} de ${formatInt(filtradas.length)} filtradas · ${formatInt(rows.length)} en total`
              : `Mostrando ${formatInt(desde + 1)}–${formatInt(desde + visibles.length)} de ${formatInt(rows.length)}`
        }
      />

      <div className="mt-3 space-y-1.5 border-t border-[var(--bi-ring)] pt-3 text-xs text-[var(--bi-ink-3)]">
        <p>
          Solo los emparejamientos que cuentan en la conversión (teléfono,
          confianza alta o media). Los empates por nombre no están acá, igual
          que no están en la cifra de conversión.
        </p>
        {sinFecha > 0 && (desdeFecha || hastaFecha) ? (
          <p>
            {formatInt(sinFecha)}{" "}
            {sinFecha === 1 ? "conversión no trae" : "conversiones no traen"}{" "}
            fecha de revisión, así que quedan fuera mientras el filtro de fechas
            esté puesto.
          </p>
        ) : null}
      </div>
    </BiCard>
  );
}
