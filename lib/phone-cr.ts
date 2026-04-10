/** Normaliza a dígitos locales CR (8 dígitos), quitando 506 si viene incluido. */
export function normalizePhoneDigitsCr(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("506") && d.length > 8) {
    d = d.slice(3);
  }
  return d;
}

export function isValidPhoneCr8Digits(digits: string): boolean {
  return digits.length === 8;
}
