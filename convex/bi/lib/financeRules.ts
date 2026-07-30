/**
 * Reglas de negocio de FINANZAS — única fuente de verdad compartida por el
 * loader de migración (`bi/finance.ts`, Sheet→Convex) y por las mutations del
 * formulario de captura manual (F5). Decisión **A39**: que ambos validen
 * IDÉNTICO y no diverjan (que el histórico y lo que teclea Esteban sigan las
 * mismas reglas de categoría, viático y FX).
 *
 * Cubre: allow-list de categorías (RF-11), forzado de viático en
 * payroll/impuestos/gastos fijos (B22) y detección de FX faltante en USD.
 * El parseo de fecha CR vive en `lib/dates.ts` (`crMidnightMs`).
 */

export type FinanceKind = "income" | "expense";
export type Currency = "CRC" | "USD";

/**
 * B22 — payroll / impuestos / gastos fijos NO son viáticos. Para estas
 * categorías se fuerza `isViatico=false`. Solo `comida`/`gasolina`/`bonos`
 * (y `otros` variable) son gastos variables/viáticos.
 */
export const FORCE_NON_VIATICO: ReadonlySet<string> = new Set([
  "salario",
  "impuestos",
  "seguro",
  "mantenimiento",
  "publicidad",
  "otros-fijo",
]);

/** Allow-list de categorías de INGRESO (RF-11). */
export const INCOME_CATS: ReadonlySet<string> = new Set([
  "inspeccion",
  "adicional_gasolina",
  "otros",
]);

/** Allow-list de categorías de GASTO (RF-11). */
export const EXPENSE_CATS: ReadonlySet<string> = new Set([
  "comida",
  "gasolina",
  "bonos",
  "otros",
  "salario",
  "mantenimiento",
  "publicidad",
  "seguro",
  "impuestos",
]);

/** Allow-list de categorías según el tipo de movimiento. */
export function allowedCategories(kind: FinanceKind): ReadonlySet<string> {
  return kind === "income" ? INCOME_CATS : EXPENSE_CATS;
}

/**
 * ¿La categoría está en la allow-list de su `kind`? Fuera de lista, el loader
 * registra `unmapped_category` (warn) pero igual carga; el formulario (F5) la
 * usa para rechazar/avisar antes de escribir.
 */
export function isCategoryAllowed(kind: FinanceKind, category: string): boolean {
  return allowedCategories(kind).has(category);
}

/**
 * B22: fuerza `isViatico=false` en payroll/impuestos/fijos. Devuelve el valor
 * efectivo y si hubo un flip real `true→false` (para las métricas del loader).
 */
export function enforceViatico(
  category: string,
  isViatico: boolean,
): { isViatico: boolean; forced: boolean } {
  if (FORCE_NON_VIATICO.has(category)) {
    return { isViatico: false, forced: isViatico };
  }
  return { isViatico, forced: false };
}

/**
 * FX faltante: un movimiento en USD DEBE traer `fxRate` (₡/US$) para poder
 * normalizar a ₡. CRC nunca requiere `fxRate`.
 */
export function isFxMissing(
  currency: Currency,
  fxRate: number | null | undefined,
): boolean {
  return currency === "USD" && (fxRate === null || fxRate === undefined);
}
