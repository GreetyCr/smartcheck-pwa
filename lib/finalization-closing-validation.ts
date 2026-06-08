export type ClosingValidationError = { key: string; message: string };

export function validateClosingFields(params: {
  totalAmountCharged?: number | null;
}): { ok: boolean; errors: ClosingValidationError[] } {
  const amount = params.totalAmountCharged ?? 0;
  if (amount > 0) {
    return { ok: true, errors: [] };
  }
  return {
    ok: false,
    errors: [
      {
        key: "totalAmountCharged",
        message: "Indica el monto total cobrado.",
      },
    ],
  };
}
