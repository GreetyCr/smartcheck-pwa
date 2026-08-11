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
  source: "sheet" | "manual" | "inspection";
  /** false en las filas que genera el sistema al entregar el reporte. */
  editable: boolean;
  createdAt: number;
};

/* -------------------------------------------------------------------------- */
/* Leads y conversión                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Espejo de `conversionFunnelReturns` (`convex/bi/matches.ts`).
 *
 * Se escribe a mano, y no se infiere de la API generada, por la misma razón que
 * los tipos de finanzas: la vista de revisión (`/dev/leads`) arma estos objetos
 * a mano y necesita el tipo sin arrastrar el cliente de Convex.
 */
export type ConversionFunnel = {
  leadsTotal: number;
  leadsWithPhone: number;
  /** Con match de cualquier banda: incluye el fallback débil por nombre. */
  leadsMatched: number;
  /** MÉTRICA TITULAR (A29): teléfono, bandas alta+media. */
  converted: number;
  convertedRatePct: number;
  convertedRateOfPhonedPct: number;
  /** Fallback débil por nombre. Va APARTE: nunca sumado al titular. */
  possibleAdditionalByName: number;
  possibleAdditionalByNameRatePct: number;
  /** Titular + posibles, solo como referencia. No es la cifra del negocio. */
  convertedIncludingName: number;
  placeholderMatches: number;
  byBand: { band: string; rows: number }[];
  byMethod: { method: string; rows: number }[];
  byTarget: { target: string; rows: number }[];
  sampleWhoConverts: {
    leadName?: string;
    phone8?: string;
    inspectionDate?: string;
    amountCRC?: number;
    confidenceBand: string;
    matchTarget: string;
  }[];
  note: string;
};

/** Espejo de `matchesStatsReturns` (`convex/bi/matches.ts`). */
export type MatchesStats = {
  totalMatches: number;
  ambiguous: number;
  validIncome: number;
  invalidIncome: number;
  byMatchKeyKind: { kind: string; rows: number }[];
  byMethod: { method: string; rows: number }[];
  byBand: { band: string; rows: number }[];
  byTarget: { target: string; rows: number }[];
  leadsWithPhone: number;
  leadsWithoutMatch: number;
  ambiguousMatchIssues: number;
};

/** Espejo de `leadsStatsReturns` (`convex/bi/leads.ts`). */
export type LeadsStats = {
  total: number;
  isDeleted: number;
  phone8Present: number;
  manychatPresent: number;
  namePresent: number;
  phoneValidTrue: number;
  phoneValidFalse: number;
  dupPhone8Groups: number;
  dupPhone8ExcessRows: number;
  dupManychatGroups: number;
  dupManychatExcessRows: number;
  minSourceCreatedAt: number;
  maxSourceCreatedAt: number;
  sourceCreatedPresent: number;
  byStage: { stage: string; rows: number }[];
  byChannel: { channel: string; rows: number }[];
  issuesByType: { issueType: string; rows: number }[];
};

/**
 * Una fila de `convertedLeads`: la lista COMPLETA de los que convirtieron, no
 * la muestra de portada. Mismo criterio que la métrica titular (`validIncome`,
 * bandas alta+media), así que acá nunca aparece un empate por nombre.
 *
 * Trae nombre y teléfono: es PII y solo se pinta en el panel de admin.
 */
export type ConvertedLead = {
  leadName?: string;
  phone8?: string;
  /** "YYYY-MM-DD" en zona CR. Puede faltar si la revisión no trae fecha. */
  inspectionDate?: string;
  amountCRC?: number;
  confidenceBand: string;
  /** "era_app" (revisión hecha en la app) | "legacy" (CRM histórico). */
  matchTarget: string;
};

/** Lead sin ninguna llave utilizable (ni teléfono ni ManyChat). */
export type LeadSinLlave = {
  /** Lo que vuelve accionable la fila: con esto se busca el registro en Airtable. */
  airtableId: string;
  name?: string;
  leadStage: string;
  sourceCreatedAt?: number;
};

/** Lead cuyo teléfono no se pudo usar como llave, con el porqué. */
export type LeadTelefonoRaro = {
  airtableId: string;
  name?: string;
  rawPhone?: string;
  /** Código estable: psid | no_cr | placeholder | primer_digito | longitud | otro. */
  motivo: string;
  sourceCreatedAt?: number;
};

/** Espejo de `leadsPorRevisarReturns` (`convex/bi/leads.ts`). */
export type LeadsPorRevisar = {
  sinLlave: LeadSinLlave[];
  telefonoRaro: LeadTelefonoRaro[];
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
