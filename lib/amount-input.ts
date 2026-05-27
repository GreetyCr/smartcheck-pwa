/** Solo dígitos (colones u otros montos enteros, sin signos ni separadores). */
export function digitsOnlyAmountInput(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function parseDigitsToAmount(raw: string): number | undefined {
  const digits = digitsOnlyAmountInput(raw);
  if (!digits) return undefined;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function formatAmountDigits(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "";
  return String(Math.max(0, Math.floor(n)));
}
