"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  buildInspectionPriceBreakdown,
  formatCrc,
} from "@/lib/admin/inspectionPrice";
import {
  formatInspectionDate,
  getInspectionUiStatus,
  type InspectionBadgeKind,
} from "@/lib/inspection-ui";
import { cn } from "@/lib/utils";

/**
 * Badges del estado sobre la superficie grafito.
 *
 * `getInspectionUiStatus` devuelve clases pensadas para fondo claro (`text-…-900`)
 * y la comparte la app de técnicos, así que **no se toca**: acá se reusa solo su
 * `kind` + `label` y se repinta con los tokens del BI.
 *
 * Contraste del texto sobre `--bi-plane` (#0f1318): income 5,9:1 · warn 10,2:1 ·
 * good 9,2:1 — todos por encima del 4,5:1 exigido para texto pequeño.
 * "Sincronizado" e "Informe entregado" comparten hue: se distinguen por relleno
 * (contorno vs. sólido) **y** por el rótulo, nunca por color solo.
 */
const BADGE_CLASS: Record<InspectionBadgeKind, string> = {
  borrador:
    "border-[var(--bi-ring)] bg-[var(--bi-plane)] text-[var(--bi-ink-2)]",
  completado:
    "border-[var(--bi-income)]/45 bg-[var(--bi-plane)] text-[var(--bi-income)]",
  pendiente_sync:
    "border-[var(--bi-warn)]/50 bg-[var(--bi-plane)] text-[var(--bi-warn)]",
  sincronizado:
    "border-[var(--bi-good)]/45 bg-[var(--bi-plane)] text-[var(--bi-good)]",
  informe_entregado:
    "border-transparent bg-[var(--bi-good)] text-[#06220f]",
};

type InspectionTableRowProps = {
  inspection: Doc<"inspections">;
  technicianName: string;
  pdfInfo?: {
    url: string | null;
    generatedAt: number;
    fileName: string;
  } | null;
};

type TooltipPos = { top: number; left: number };

function formatPlate(inspection: Doc<"inspections">): string {
  if (inspection.identifierType === "placa" && inspection.identifier?.trim()) {
    return inspection.identifier.trim().toUpperCase();
  }
  if (inspection.identifier?.trim()) {
    return inspection.identifier.trim().slice(-8);
  }
  return "—";
}

function PriceBreakdownTooltip({
  totalLabel,
  breakdown,
}: {
  totalLabel: string;
  breakdown: ReturnType<typeof buildInspectionPriceBreakdown>;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const tipWidth = tip?.offsetWidth ?? 224;
    const tipHeight = tip?.offsetHeight ?? 160;
    const gap = 8;
    const margin = 8;

    let left = rect.right - tipWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - tipWidth - margin));

    const spaceAbove = rect.top;
    const placeBelow = spaceAbove < tipHeight + gap + margin;
    const top = placeBelow
      ? rect.bottom + gap
      : rect.top - tipHeight - gap;

    setPos({
      top: Math.max(margin, top),
      left,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  const show = () => {
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      // Posición provisional; se refina tras montar el tip.
      setPos({
        top: Math.max(8, rect.top - 168),
        left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)),
      });
    }
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    setPos(null);
  };

  return (
    <>
      <span
        ref={triggerRef}
        className={cn(
          "bi-num cursor-default rounded font-semibold text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
          totalLabel === "—" && "font-normal text-[var(--bi-ink-3)]",
        )}
        tabIndex={0}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {totalLabel}
      </span>
      {/* El tooltip se monta en `document.body`, fuera de `.bi-graphite`, así
          que lleva su propio ámbito de tema: sin él los tokens no resuelven y
          la tarjeta sale transparente. */}
      {mounted && open && pos
        ? createPortal(
            <div
              ref={(node) => {
                tipRef.current = node;
                if (node) {
                  // Remedir con tamaño real en el siguiente frame.
                  requestAnimationFrame(updatePosition);
                }
              }}
              id={tipId}
              role="tooltip"
              className="bi-graphite pointer-events-none fixed z-9999 w-56 rounded-xl border border-[var(--bi-ring)] bg-[var(--bi-surface-2)] p-3 text-left shadow-2xl"
              style={{ top: pos.top, left: pos.left }}
            >
              <p className="bi-num mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--bi-ink-3)]">
                Desglose de precio
              </p>
              <ul className="space-y-1.5">
                {breakdown.map((line) => (
                  <li
                    key={line.label}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <span className="text-[var(--bi-ink-3)]">{line.label}</span>
                    <span className="bi-num shrink-0 font-medium text-[var(--bi-ink)]">
                      {line.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Los nombres de estado **en las palabras del panel** — A146.
 *
 * `getInspectionUiStatus` lo comparten las dos superficies, y su vocabulario
 * —«PENDIENTE SYNC», «SINCRONIZADO»— es el del técnico, que sí sabe qué es
 * sincronizar porque es su flujo de trabajo. En el panel lo lee Esteban, y ahí
 * «sync» es palabra ajena.
 *
 * A136 tradujo estos nombres en la portada y **no llegó acá**: la misma pantalla
 * mostraba «Falta subirla» en un lado y «PENDIENTE SYNC» en el otro. Se traduce
 * solo del lado del panel para no tocar la app del técnico, que está bien como
 * está.
 */
const ETIQUETA_BI: Record<string, string> = {
  BORRADOR: "SIN TERMINAR",
  COMPLETADO: "TERMINADA",
  "PENDIENTE SYNC": "FALTA SUBIRLA",
  SINCRONIZADO: "YA SUBIDA",
};

export function InspectionTableRow({
  inspection,
  technicianName,
  pdfInfo,
}: InspectionTableRowProps) {
  const { kind, label: labelTecnico } = getInspectionUiStatus(inspection);
  const label = ETIQUETA_BI[labelTecnico] ?? labelTecnico;
  const breakdown = buildInspectionPriceBreakdown(inspection);
  const totalLabel = formatCrc(inspection.totalAmountCharged);

  return (
    <tr className="border-b border-[var(--bi-ring)]/60 text-sm transition-colors last:border-0 hover:bg-[var(--bi-surface-2)]">
      <td className="px-3 py-3">
        <Link
          href={`/inspecciones/${inspection._id}`}
          className="bi-num rounded font-semibold text-[var(--bi-ink)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
        >
          {formatPlate(inspection)}
        </Link>
      </td>
      <td className="hidden px-3 py-3 text-[var(--bi-ink-2)] sm:table-cell">
        {[inspection.vehicleBrand, inspection.vehicleModel, inspection.vehicleYear]
          .filter(Boolean)
          .join(" ") || "—"}
      </td>
      <td className="px-3 py-3 text-[var(--bi-ink-2)]">{technicianName}</td>
      <td className="hidden whitespace-nowrap px-3 py-3 text-[var(--bi-ink-3)] md:table-cell">
        {formatInspectionDate(inspection._creationTime)}
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            "inline-block whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
            BADGE_CLASS[kind],
          )}
        >
          {label}
        </span>
      </td>
      <td className="px-3 py-3 text-right">
        <PriceBreakdownTooltip totalLabel={totalLabel} breakdown={breakdown} />
      </td>
      <td className="px-3 py-3 text-right">
        {pdfInfo?.url ? (
          /* `relative` es obligatorio: el `sr-only` de abajo es
             `position:absolute` y, sin ancestro posicionado, su bloque
             contenedor sería el ICB. Al estar a ~730px del borde izquierdo se
             escapaba del `overflow-x-auto` de la tabla y le metía scroll
             horizontal al documento entero. */
          <a
            href={pdfInfo.url}
            target="_blank"
            rel="noreferrer"
            className="relative inline-flex items-center gap-1 rounded-lg border border-[var(--bi-income)]/45 px-2 py-1 text-xs font-semibold text-[var(--bi-income)] transition-colors hover:bg-[var(--bi-income)]/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
          >
            <FileText className="size-3.5" aria-hidden />
            PDF
            <span className="sr-only">
              {" "}
              de la inspección {formatPlate(inspection)}
            </span>
          </a>
        ) : (
          <span className="text-xs text-[var(--bi-ink-3)]">—</span>
        )}
      </td>
    </tr>
  );
}
