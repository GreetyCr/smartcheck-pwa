/**
 * Tipos de la capa visual del BI. Los componentes son **presentacionales**:
 * reciben datos por props, no consultan Convex. Así la página real (`/admin/
 * finanzas`) y la vista de revisión visual (`/dev/finanzas`, con datos de
 * muestra) comparten exactamente el mismo render.
 */

export type FinanceMonth = {
  yearMonth: string;
  rows: number;
  income: number;
  expense: number;
  utilidad: number;
  marginPct: number;
};

export type FinanceTotals = {
  rows: number;
  income: number;
  expense: number;
  utilidad: number;
  marginPct: number;
  viaticoCount: number;
  viaticoAmountCRC: number;
};

export type FinanceSummary = {
  months: FinanceMonth[];
  totals: FinanceTotals;
};

export type FinanceEntry = {
  id: string;
  kind: "income" | "expense";
  category: string;
  amountCRC: number;
  originalAmount?: number;
  originalCurrency: "CRC" | "USD";
  fxRate?: number;
  date: number;
  yearMonth: string;
  isViatico: boolean;
  note?: string;
  tecnico?: string;
  localidad?: string;
  source: "sheet" | "manual";
  createdAt: number;
};

/** Payload del formulario (mismo contrato que las mutations F5). */
export type FinanceEntryInput = {
  kind: "income" | "expense";
  category: string;
  originalAmount: number;
  originalCurrency: "CRC" | "USD";
  fxRate?: number;
  date: string; // "YYYY-MM-DD"
  isViatico: boolean;
  note?: string;
  tecnico?: string;
  localidad?: string;
};
