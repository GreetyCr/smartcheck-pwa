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
import { formatInspectionDate, getInspectionUiStatus } from "@/lib/inspection-ui";
import { cn } from "@/lib/utils";

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
          "cursor-default font-semibold tabular-nums text-[#1E3A5F]",
          totalLabel === "—" && "font-normal text-muted-foreground",
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
              className="pointer-events-none fixed z-9999 w-56 rounded-xl border border-border bg-white p-3 text-left shadow-lg"
              style={{ top: pos.top, left: pos.left }}
            >
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Desglose de precio
              </p>
              <ul className="space-y-1.5">
                {breakdown.map((line) => (
                  <li
                    key={line.label}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <span className="text-muted-foreground">{line.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
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

export function InspectionTableRow({
  inspection,
  technicianName,
  pdfInfo,
}: InspectionTableRowProps) {
  const { label, className: badgeClass } = getInspectionUiStatus(inspection);
  const breakdown = buildInspectionPriceBreakdown(inspection);
  const totalLabel = formatCrc(inspection.totalAmountCharged);

  return (
    <tr className="border-b border-border/80 bg-white text-sm last:border-0">
      <td className="px-3 py-3 font-semibold text-[#1E3A5F]">
        <Link
          href={`/inspecciones/${inspection._id}`}
          className="hover:underline"
        >
          {formatPlate(inspection)}
        </Link>
      </td>
      <td className="hidden px-3 py-3 text-muted-foreground sm:table-cell">
        {[inspection.vehicleBrand, inspection.vehicleModel, inspection.vehicleYear]
          .filter(Boolean)
          .join(" ") || "—"}
      </td>
      <td className="px-3 py-3 text-muted-foreground">{technicianName}</td>
      <td className="hidden px-3 py-3 text-muted-foreground md:table-cell">
        {formatInspectionDate(inspection._creationTime)}
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            "inline-block rounded-lg px-2 py-1 text-[10px] font-bold uppercase",
            badgeClass,
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
          <a
            href={pdfInfo.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-[#FF8C00]/40 px-2 py-1 text-xs font-semibold text-[#FF8C00] hover:bg-[#FF8C00]/10"
          >
            <FileText className="size-3.5" />
            PDF
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
