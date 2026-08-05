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
  "comision",
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
  // Comisión de venta (`commissionFeeAmount` de la inspección). Costo variable
  // atado al ingreso, NO payroll: hasta ahora el Sheet la mapeaba a `salario`
  // (7 filas, ₡303.427), que es lo que marcan los issues `viatico_review`.
  "comision",
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

/* -------------------------------------------------------------------------- */
/* F5-auto — ingreso derivado de la inspección entregada                       */
/* -------------------------------------------------------------------------- */

export type FinanceSource = "sheet" | "manual" | "inspection";

/**
 * Una fila `source:"inspection"` la escribe el sistema al entregar el reporte y
 * se re-deriva de la inspección: editarla a mano se perdería en la siguiente
 * re-derivación. El formulario (F5) la muestra pero no la deja tocar.
 */
export function isSystemGenerated(source: FinanceSource): boolean {
  return source === "inspection";
}

/**
 * B15 — ₡0 y ₡1.000 son placeholders del histórico, no cobros reales (las
 * métricas ya los excluyen). La auto-captura NO crea ingreso con esos montos;
 * registra un `bi_quality_issue` para que se vea, en vez de meter un ingreso
 * fantasma en la utilidad. Protege de un dedazo futuro, no del pasado.
 */
export const MIN_REAL_CHARGE_CRC = 1_000;

export function isPlaceholderCharge(
  amountCRC: number | null | undefined,
): boolean {
  return (
    amountCRC === null ||
    amountCRC === undefined ||
    !Number.isFinite(amountCRC) ||
    amountCRC <= MIN_REAL_CHARGE_CRC
  );
}

/**
 * Descompone lo cobrado en el par de asientos que van al ledger.
 *
 * `totalAmountCharged` es **bruto** (confirmado por Esteban, 5-ago): la
 * comisión NO viene restada, y desde ahora el adicional fuera del GAM ya va
 * incluido en ese total. Por eso el ingreso se guarda completo y la comisión
 * va como gasto aparte, en vez de netear: si guardáramos ₡54.000 donde la
 * inspección dice ₡59.000, la conciliación mostraría un gap artificial
 * permanente justo cuando por fin tendría datos limpios.
 */
export function splitInspectionCharge(input: {
  totalAmountCharged: number;
  commissionFeeAmount?: number | null;
}): { income: number; commission: number | null } {
  const commission =
    typeof input.commissionFeeAmount === "number" &&
    Number.isFinite(input.commissionFeeAmount) &&
    input.commissionFeeAmount > 0
      ? input.commissionFeeAmount
      : null;
  return { income: input.totalAmountCharged, commission };
}
