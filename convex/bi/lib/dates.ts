/**
 * Helpers de fecha para el BI — zona horaria de negocio: America/Costa_Rica.
 *
 * Convención (MODELO-DATOS §1.2, AGENTS §1.6):
 *  - Las fechas de negocio se guardan como **epoch ms** (`number`).
 *  - Los agrupadores de periodo (`yearMonth`) se calculan en la zona CR.
 *
 * Costa Rica no observa horario de verano (UTC-6 fijo), pero usamos
 * `Intl.DateTimeFormat` con `timeZone` para no hardcodear el offset.
 *
 * NOTA: el helper de tipo de cambio (`lib/fx.ts`, firma `rateForDate`) lo
 * agrega WP-2 — no vive en este archivo.
 */

/** Zona horaria de negocio del proyecto. */
export const CR_TIME_ZONE = "America/Costa_Rica" as const;

/** Cadena de año-mes, ej. "2025-09". */
export type YearMonth = string;

/**
 * Devuelve las partes de fecha (año, mes, día) de un epoch ms
 * interpretadas en la zona horaria de Costa Rica.
 */
export function crDateParts(epochMs: number): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epochMs));

  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new Error(`crDateParts: parte "${type}" ausente`);
    return Number(found.value);
  };

  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * Agrupador de periodo mensual "YYYY-MM" en zona CR.
 * Ej: `yearMonth(1725148800000)` → "2024-09".
 */
export function yearMonth(epochMs: number): YearMonth {
  const { year, month } = crDateParts(epochMs);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Fecha ISO "YYYY-MM-DD" en zona CR (útil para llaves de feriados, logs).
 */
export function isoDate(epochMs: number): string {
  const { year, month, day } = crDateParts(epochMs);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Epoch ms actual (indirección testeable para `Date.now()`). */
export function nowMs(): number {
  return Date.now();
}
