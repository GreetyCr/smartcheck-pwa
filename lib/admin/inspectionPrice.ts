import type { Doc } from "@/convex/_generated/dataModel";
import { COMMISSION_SERVICE_FEE_CRC } from "@/lib/commission";

/** Formato CRC para tablas admin (₡12.345). */
export function formatCrc(amount: number | undefined | null): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return `₡${Math.round(amount).toLocaleString("es-CR")}`;
}

export type PriceBreakdownLine = { label: string; value: string };

/** Desglose de montos BI asociados a una inspección. */
export function buildInspectionPriceBreakdown(
  inspection: Doc<"inspections">,
): PriceBreakdownLine[] {
  const lines: PriceBreakdownLine[] = [
    {
      label: "Total cobrado",
      value: formatCrc(inspection.totalAmountCharged),
    },
  ];

  if (inspection.inspectionFee != null && Number.isFinite(inspection.inspectionFee)) {
    lines.push({
      label: "Tarifa de inspección",
      value: formatCrc(inspection.inspectionFee),
    });
  }

  const inGam = inspection.inGam;
  if (inGam === "si" || inGam === "no") {
    lines.push({
      label: "En GAM",
      value: inGam === "si" ? "Sí" : "No",
    });
  }

  if (inGam === "no") {
    lines.push({
      label: "Cargo fuera de GAM",
      value: formatCrc(inspection.outOfGamFee),
    });
  } else if (
    inspection.outOfGamFee != null &&
    Number.isFinite(inspection.outOfGamFee) &&
    inspection.outOfGamFee > 0
  ) {
    lines.push({
      label: "Cargo fuera de GAM",
      value: formatCrc(inspection.outOfGamFee),
    });
  }

  const commission = inspection.biCommission;
  if (commission === "si" || commission === "no") {
    lines.push({
      label: "Servicio por comisión",
      value: commission === "si" ? "Sí" : "No",
    });
  }

  if (commission === "si") {
    const fee =
      inspection.commissionFeeAmount ?? COMMISSION_SERVICE_FEE_CRC;
    lines.push({
      label: "Comisión",
      value: formatCrc(fee),
    });
  } else if (
    inspection.commissionFeeAmount != null &&
    inspection.commissionFeeAmount > 0
  ) {
    lines.push({
      label: "Comisión",
      value: formatCrc(inspection.commissionFeeAmount),
    });
  }

  return lines;
}
