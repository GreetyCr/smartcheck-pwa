"use client";

import Link from "next/link";
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

function formatPlate(inspection: Doc<"inspections">): string {
  if (inspection.identifierType === "placa" && inspection.identifier?.trim()) {
    return inspection.identifier.trim().toUpperCase();
  }
  if (inspection.identifier?.trim()) {
    return inspection.identifier.trim().slice(-8);
  }
  return "—";
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
        <div className="group relative inline-flex justify-end">
          <span
            className={cn(
              "cursor-default font-semibold tabular-nums text-[#1E3A5F]",
              totalLabel === "—" && "font-normal text-muted-foreground",
            )}
            tabIndex={0}
          >
            {totalLabel}
          </span>
          <div
            role="tooltip"
            className={cn(
              "pointer-events-none absolute right-0 bottom-full z-20 mb-2 w-56 rounded-xl border border-border bg-white p-3 text-left shadow-lg",
              "opacity-0 transition-opacity duration-150",
              "group-hover:opacity-100 group-focus-within:opacity-100",
            )}
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
          </div>
        </div>
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
