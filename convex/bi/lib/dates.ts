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

/**
 * Medianoche local CR (UTC-6 fijo, sin DST) de un día ISO "YYYY-MM-DD" → epoch ms.
 * Lanza si el día es inválido. Usado por la carga (`bi/finance.ts`) y por la
 * captura manual del formulario de finanzas (F5) — misma conversión en ambos.
 */
export function crMidnightMs(isoDay: string): number {
  const ms = Date.parse(`${isoDay}T00:00:00-06:00`);
  if (Number.isNaN(ms)) throw new Error(`fecha inválida: "${isoDay}"`);
  return ms;
}

/** Epoch ms actual (indirección testeable para `Date.now()`). */
export function nowMs(): number {
  return Date.now();
}

/**
 * Lunes de la semana a la que pertenece un día, como ISO "YYYY-MM-DD" en CR.
 *
 * La semana de Esteban va de **lunes a domingo** (B36). Se calcula sobre las
 * partes CR y no sobre el epoch: `new Date(ms).getDay()` da el día de la semana
 * de la zona del servidor, que en Convex es UTC — y una revisión de las 7 de la
 * noche del domingo en Costa Rica ya es lunes en UTC. Ese error correría la
 * revisión a la semana siguiente y, si el domingo es fin de mes, al mes
 * siguiente.
 */
export function lunesDeLaSemana(epochMs: number): string {
  const { year, month, day } = crDateParts(epochMs);
  // Mediodía UTC del día CR: lejos de cualquier borde, así que `getUTCDay` da el
  // día de la semana correcto sin depender de la zona del proceso.
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes … 6 = domingo
  d.setUTCDate(d.getUTCDate() - dow);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * El mes al que se le carga una fecha para efectos de pago al técnico: **el mes
 * en que ARRANCÓ su semana**.
 *
 * Es la regla de Esteban, y la razón por la que su conteo de julio no era el
 * nuestro: los días 1, 2 y 3 de julio cayeron en una semana que empezó el lunes
 * 29 de junio, así que para él fueron de junio (B36).
 */
export function mesDePagoSemanal(epochMs: number): YearMonth {
  return lunesDeLaSemana(epochMs).slice(0, 7);
}
