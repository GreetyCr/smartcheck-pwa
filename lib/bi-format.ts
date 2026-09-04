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

/**
 * Porcentaje con una decimal: `38,7%`.
 *
 * `decimals` sube la precisión donde una décima cambiaría la cifra que se
 * comunica: la conversión titular es **2,07%** y redondeada a una decimal se
 * leería 2,1% — un número que no aparece en ningún otro lado del proyecto.
 */
export function formatPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals).replace(".", ",")}%`;
}

/** `"89903618"` → `"8990-3618"` (formato local de 8 dígitos). */
export function formatPhone8(phone8: string): string {
  return /^\d{8}$/.test(phone8) ? `${phone8.slice(0, 4)}-${phone8.slice(4)}` : phone8;
}

/** `"2026-08-07"` (ISO de fecha, zona CR) → `"07 ago 2026"`. */
export function formatIsoDateCR(iso: string): string {
  const ms = Date.parse(`${iso}T00:00:00-06:00`);
  return Number.isNaN(ms) ? iso : formatDateCR(ms);
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
  servicios_profesionales: "Servicios profesionales",
  software: "Software y herramientas",
  equipo: "Equipo",
  telefonia: "Telefonía",
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
  /* Orden de uso, no alfabético: arriba lo que más se anota. Las cuatro
     últimas entraron en A143, cuando se vio que «Otros» era la categoría más
     grande del panel solo porque no había dónde poner lo demás. */
  "servicios_profesionales",
  "software",
  "publicidad",
  "gasolina",
  "telefonia",
  "equipo",
  "mantenimiento",
  "seguro",
  "impuestos",
  "salario",
  "comision",
  "bonos",
  "comida",
  "otros",
] as const;

/**
 * Cada cuántos meses se rotula el eje, según cuántos haya y qué tan ancha sea
 * la pantalla — **A114**.
 *
 * No es cosmética: el rótulo largo («ABR 25») mide **38px** y el corto («ABR»)
 * **18,8px**, medido. Con 18 meses el área de trazado da casillas de 25,5px en
 * escritorio y ~13px a 375px, así que sin saltar rótulos el texto **se parte en
 * dos líneas** —las 18, incluso en escritorio— y el eje se vuelve una pared.
 * Saltando uno de cada dos, cada rótulo dispone del doble y vuelve a leerse.
 *
 * Los meses saltados **no se pierden**: conservan su barra, su tooltip y su
 * `aria-label`. Lo único que deja de escribirse es lo que no cabía.
 *
 * Los umbrales salen de la medición, no del gusto: en escritorio el rótulo
 * largo entra cómodo hasta 12 meses; en angosto el corto entra hasta 8.
 */
export function pasoEtiquetasMes(meses: number, angosto: boolean): number {
  if (angosto) return meses > 16 ? 3 : meses > 8 ? 2 : 1;
  return meses > 12 ? 2 : 1;
}

/**
 * La variación contra un periodo de referencia — **A135**.
 *
 * **Un número de gestión sin su comparación no es información.** «₡1,1M de
 * utilidad» no le dice a nadie si el mes fue bueno; «₡1,1M, 60% más que julio»
 * sí. Es la regla más dura del reporte de gestión y la portada no la cumplía:
 * decía cuánto y casi nunca cuánto más o menos que antes.
 *
 * `contra` **nombra** el periodo de referencia en vez de referirlo. Decía «vs
 * anterior», y anterior a qué es justo lo que el lector no sabe.
 *
 * Devuelve `null` cuando no hay con qué comparar —sin dato previo, o previo en
 * cero, donde el porcentaje sería infinito—. Eso es distinto de «no cambió», y
 * por eso no se colapsan: sin base la tarjeta no muestra variación, no muestra
 * un 0%.
 */
export function variacion(
  ahora: number,
  antes: number | undefined | null,
  contra: string,
): { pct: number; label: string } | null {
  if (antes == null || antes === 0) return null;
  const pct = ((ahora - antes) / Math.abs(antes)) * 100;
  if (Math.abs(pct) < 0.05) return { pct: 0, label: `sin cambio ${contra}` };
  return {
    pct,
    label: `${Math.abs(pct).toFixed(1).replace(".", ",")}% ${contra}`,
  };
}
