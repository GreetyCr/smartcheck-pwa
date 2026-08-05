/**
 * Formato para el tablero del BI — convenciones de Costa Rica (es-CR):
 * separador de miles `.`, decimales `,`, colón `₡` sin decimales (los montos
 * se guardan ya normalizados a colones enteros).
 */

/**
 * OJO con la localización: `Intl` con `es-CR` agrupa los miles con un **espacio
 * fino** (`₡850 000`), pero en Costa Rica se escribe `₡850.000`. Se usa el
 * agrupamiento de `de-DE` (idéntica convención: `.` miles, `,` decimales) y el
 * símbolo `₡` se antepone a mano.
 */
const NUM = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/** Monto exacto: `₡45.704.410`. Para tablas y tooltips. */
export function formatCRC(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}₡${NUM.format(Math.abs(n))}`;
}

/** Monto compacto: `₡45,7M` · `₡820k`. Para KPIs y ejes. */
export function formatCompactCRC(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}₡${m.toFixed(m >= 10 ? 1 : 2).replace(".", ",")}M`;
  }
  if (abs >= 1_000) return `${sign}₡${Math.round(abs / 1_000)}k`;
  return `${sign}₡${NUM.format(abs)}`;
}

/** Porcentaje con una decimal: `38,7%`. */
export function formatPct(n: number): string {
  return `${n.toFixed(1).replace(".", ",")}%`;
}

/** Entero con separadores: `8.406`. */
export function formatInt(n: number): string {
  return NUM.format(n);
}

const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** `"2026-07"` → `"JUL 26"` (etiqueta de eje). */
export function formatMonthShort(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  const idx = Number(m) - 1;
  const name = MONTHS_SHORT[idx] ?? m;
  return `${name.toUpperCase()} ${y.slice(2)}`;
}

/** `"2026-07"` → `"JUL"` (etiqueta de eje en pantallas angostas). */
export function formatMonthAbbr(yearMonth: string): string {
  const m = yearMonth.split("-")[1];
  return (MONTHS_SHORT[Number(m) - 1] ?? m).toUpperCase();
}

/** `"2026-07"` → `"julio 2026"` (título legible). */
export function formatMonthLong(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  const long = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "setiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${long[Number(m) - 1] ?? m} ${y}`;
}

/** epoch ms → `"15 jul 2026"` en zona de Costa Rica. */
export function formatDateCR(ms: number): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

/** epoch ms → `"2026-07-15"` (valor para `<input type="date">`, zona CR). */
export function toDateInputValue(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  return parts; // en-CA ya entrega "YYYY-MM-DD"
}

/** Etiquetas legibles de categoría (las claves son las de la allow-list). */
export const CATEGORY_LABELS: Record<string, string> = {
  inspeccion: "Inspección",
  adicional_gasolina: "Adicional gasolina",
  otros: "Otros",
  comida: "Comida",
  gasolina: "Gasolina",
  bonos: "Bonos",
  salario: "Salario",
  mantenimiento: "Mantenimiento",
  publicidad: "Publicidad",
  seguro: "Seguro",
  impuestos: "Impuestos",
  comision: "Comisión",
};

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key;
}

/** Categorías por tipo — espejo de la allow-list del backend (RF-11). */
export const INCOME_CATEGORIES = [
  "inspeccion",
  "adicional_gasolina",
  "otros",
] as const;

export const EXPENSE_CATEGORIES = [
  "comida",
  "gasolina",
  "bonos",
  "otros",
  "salario",
  "comision",
  "mantenimiento",
  "publicidad",
  "seguro",
  "impuestos",
] as const;
