import { describe, expect, it } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  buildInspectionPriceBreakdown,
  formatCrc,
} from "@/lib/admin/inspectionPrice";

function fakeInspection(
  partial: Partial<Doc<"inspections">>,
): Doc<"inspections"> {
  return {
    _id: "jxinspections1" as Doc<"inspections">["_id"],
    _creationTime: 0,
    ...partial,
  };
}

describe("inspectionPrice", () => {
  it("formatea CRC", () => {
    expect(formatCrc(69000)).toBe("₡69.000");
    expect(formatCrc(undefined)).toBe("—");
  });

  it("arma desglose con total, GAM y comisión", () => {
    const lines = buildInspectionPriceBreakdown(
      fakeInspection({
        totalAmountCharged: 69000,
        inGam: "no",
        outOfGamFee: 15000,
        biCommission: "si",
        commissionFeeAmount: 5000,
        inspectionFee: 49000,
      }),
    );
    expect(lines.map((l) => l.label)).toEqual([
      "Total cobrado",
      "Tarifa de inspección",
      "En GAM",
      "Cargo fuera de GAM",
      "Servicio por comisión",
      "Comisión",
    ]);
    expect(lines[0]?.value).toBe("₡69.000");
    expect(lines.find((l) => l.label === "En GAM")?.value).toBe("No");
  });
});
