import { describe, expect, it } from "vitest";
import { applyCommissionPatchSideEffects } from "../../convex/lib/commission";
import { COMMISSION_SERVICE_FEE_CRC } from "@/lib/commission";

describe("applyCommissionPatchSideEffects", () => {
  it("sets commission fee when biCommission is si", () => {
    const out = applyCommissionPatchSideEffects({ biCommission: "si" });
    expect(out.commissionFeeAmount).toBe(COMMISSION_SERVICE_FEE_CRC);
  });

  it("clears commission fee when biCommission is no", () => {
    const out = applyCommissionPatchSideEffects({ biCommission: "no" });
    expect(out.commissionFeeAmount).toBe(0);
  });
});
