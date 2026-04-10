"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
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
