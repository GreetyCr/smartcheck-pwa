import { COMMISSION_SERVICE_FEE_CRC } from "@/lib/commission";

export { COMMISSION_SERVICE_FEE_CRC };

export function commissionFeeForBiFlag(
  biCommission: "si" | "no" | undefined,
): number | undefined {
  if (biCommission === "si") return COMMISSION_SERVICE_FEE_CRC;
  if (biCommission === "no") return undefined;
  return undefined;
}

/** Aplica reglas de comisión al patch de inspección (no exponer monto al cliente). */
export function applyCommissionPatchSideEffects(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  if (!("biCommission" in patch)) return patch;
  const flag = patch.biCommission;
  if (flag === "si") {
    return { ...patch, commissionFeeAmount: COMMISSION_SERVICE_FEE_CRC };
  }
  if (flag === "no") {
    return { ...patch, commissionFeeAmount: 0 };
  }
  return patch;
}
