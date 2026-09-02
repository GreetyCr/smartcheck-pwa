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

/**
 * Espejo de `executiveSummaryReturns` (`convex/bi/metrics.ts`).
 *
 * **Cuidado al leerlo: no todos los campos respetan `fromMs`/`toMs`.** El
 * impl filtra las revisiones y `finance_entries` por el rango, pero
 * `leads_contacts` y `bi_matches` los lee enteros. O sea que
 * `leadsTotal`, `convertidos` y los tres porcentajes de conversión son
 * **siempre históricos**, sin importar el periodo que se le pase.
 *
 * No es un descuido que haya que tapar en la pantalla: una tasa de conversión
 * acotada a un periodo mezcla cohortes (un lead de marzo que compra en agosto)
 * y puede pasar del 100%. Por eso el tablero los agrupa **aparte**, bajo un
 * rótulo que dice que son del histórico completo, en vez de dejarlos entre los
 * que sí se mueven.
 */
export type ExecutiveSummary = {
  /** Con placeholders (₡0 / ₡1.000). Respeta el periodo. */
  totalRevisiones: number;
  totalRevisionesSinPlaceholder: number;
  placeholderRows: number;
  revisionesConMonto: number;
  /** Ingresos según las REVISIONES. No es el titular — ver A16. */
  ingresosInspeccionesCRC: number;
  /** Ingresos del P&L (`finance_entries`). Este es el titular. */
  ingresosFinancierosCRC: number;
  gastosCRC: number;
  utilidadCRC: number;
  marginPct: number;
  /** Histórico: NO respeta el periodo. */
  leadsTotal: number;
  /** Histórico: NO respeta el periodo. */
  leadsWithPhone: number;
  /** Histórico: NO respeta el periodo. */
  convertidos: number;
  /** Histórico: NO respeta el periodo. */
  conversionPct: number;
  /** Histórico: NO respeta el periodo. */
  conversionPctOfPhoned: number;
  leadToClientePct: number;
  note: string;
};

/**
 * Espejo de `reconciliationReturns` (`convex/bi/metrics.ts`).
 *
 * **El signo del gap importa más que su tamaño.** `gapAbs = ingresos − revisiones`:
 *  - **Positivo** → entró plata que ninguna revisión explica (venta de informes,
 *    adicionales, o una revisión anotada en otro mes).
 *  - **Negativo** → hay revisiones cobradas que no aparecen en la contabilidad.
 *    Ese es el lado que puede significar plata perdida.
 *
 * Un tablero que muestre solo `|gapPct|` mete las dos cosas en la misma bolsa.
 */
export type Reconciliation = {
  months: Array<{
    yearMonth: string;
    inspectionsIncome: number;
    inspectionsCount: number;
    financeIncome: number;
    /** `financeIncome − inspectionsIncome`. Ver la nota de arriba sobre el signo. */
    gapAbs: number;
    gapPct: number;
    significant: boolean;
    /** Mes vivo: gap negativo normal, nunca `significant` (A59). */
    enCurso: boolean;
    /** Revisiones del mes sin informe entregado. Solo en el mes en curso. */
    sinEntregar?: number;
    /** El mes tiene al menos un ingreso capturado por el sistema. */
    autoCaptura: boolean;
  }>;
  totals: {
    inspectionsIncome: number;
    financeIncome: number;
    gapAbs: number;
    gapPct: number;
    significant: boolean;
    gapAbsMesesCerrados: number;
    /** La cifra comparable: la misma sin el mes en curso. */
    gapPctMesesCerrados: number;
  };
  thresholdPct: number;
  financeStartISO: string;
  primerMesAutoCaptura: string | null;
  note: string;
};

/** Espejo de `operacionReturns` (`convex/bi/operacion.ts`) — RF-07.
 *
 * **Cada porcentaje de acá tiene un denominador distinto**, y esa es la única
 * forma de leerlo bien:
 *  - `hallazgos.top[].pct` → sobre `evaluados` (las veces que ese punto se
 *    revisó), NO sobre el total de revisiones.
 *  - `condicion.niveles[].pct` → sobre las revisiones **con** el dato.
 *  - Lo del SLA → sobre `sla.medibles`, que es menos que `sla.entregadas`.
 */
export type Operacion = {
  revisiones: { total: number; entregadas: number; conChecklist: number };
  condicion: {
    niveles: Array<{
      nivel: number;
      etiqueta: string;
      rows: number;
      pct: number;
    }>;
    sinDato: number;
  };
  hallazgos: {
    evaluadas: number;
    total: number;
    promedioPorRevision: number;
    sinHallazgos: number;
    porSeccion: Array<{
      seccion: string;
      etiqueta: string;
      hallazgos: number;
      revisionesConAlguno: number;
      revisionesEvaluadas: number;
      pct: number;
    }>;
    top: Array<{
      seccion: string;
      seccionEtiqueta: string;
      item: string;
      itemEtiqueta: string;
      hallazgos: number;
      evaluados: number;
      pct: number;
    }>;
    fueraDelRanking: number;
    minEvaluaciones: number;
    /** Debe estar vacío. Si trae algo, hay un punto del formulario sin catalogar. */
    itemsSinCatalogar: string[];
  };
  sla: {
    medibles: number;
    entregadas: number;
    sinFechaInicio: number;
    inconsistentes: number;
    medianaHoras: number;
    p90Horas: number;
    maxHoras: number;
    dentroDe24h: number;
    dentroDe48h: number;
    porMes: Array<{ ym: string; rows: number; medianaHoras: number }>;
    sinFechaEntrega: number;
  };
  nota: string;
};

/** Espejo de `contrasteReturns` (`convex/bi/contraste.ts`) — A56.
 *
 * **Dos comparaciones que no son la misma** y por eso van en campos distintos:
 *  - `meses[].difIngreso/difGasto` = el panel contra **las filas** de la hoja.
 *    Es la alarma: si un mes cambió allá después de copiarlo, sale acá.
 *  - `hojaNoCuadra` = las filas de la hoja contra **su propia celda TOTAL**.
 *    No dice nada del panel; dice que la hoja se equivoca en su suma.
 */
export type ContrasteHoja = {
  corridaAt: number | null;
  estado: string | null;
  mensaje: string | null;
  meses: Array<{
    yearMonth: string;
    moneda: string;
    hojaIngreso: number;
    hojaGasto: number;
    hojaFilas: number;
    totalIngreso: number | null;
    totalGasto: number | null;
    convexIngreso: number;
    convexGasto: number;
    convexFilas: number;
    difIngreso: number;
    difGasto: number;
    difTotalIngreso: number | null;
    difTotalGasto: number | null;
    significativo: boolean;
    explicacion: string | null;
  }>;
  conDiferencia: number;
  conExplicacion: number;
  hojaNoCuadra: Array<{
    yearMonth: string;
    moneda: string;
    campo: string;
    filas: number;
    total: number;
    diferencia: number;
  }>;
  tolerancia: number;
  nota: string;
};

/** Una fila de `channelRevenue.canales` (`convex/bi/channels.ts`). */
export type ChannelMixRow = {
  canal: string;
  rows: number;
  rowsConMonto: number;
  ingresosCRC: number;
  pctIngresos: number;
  pctRows: number;
  ticketPromedioCRC: number;
  ultimaRevisionISO: string | null;
  mesesSinRevision: number;
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
/** Una cohorte mensual del embudo: los leads que llegaron en ese mes (A113). */
export type ConversionPorMes = {
  yearMonth: string;
  leads: number;
  convertidos: number;
  /** Ya eran clientes y volvieron a escribir: NO cuentan como conversión (A112). */
  recompras: number;
  tasaPct: number;
};

export type ConversionFunnel = {
  leadsTotal: number;
  leadsWithPhone: number;
  /** Con match de cualquier banda: incluye el fallback débil por nombre. */
  leadsMatched: number;
  /** Leads sin fecha de creación: no se pueden ubicar en un periodo. */
  leadsSinFecha: number;
  /** ¿Hay periodo puesto? Cambia qué universo describen las cifras. */
  conPeriodo: boolean;
  /** Revisión anterior al lead: recompra, no conversión (A112). */
  recompras: number;
  porMes: ConversionPorMes[];
  /** MÉTRICA TITULAR (A29): teléfono, bandas alta+media, sin recompras. */
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

/** Un mes del control de inspecciones: el total y de dónde sale (A114). */
export type InspeccionMes = {
  yearMonth: string;
  total: number;
  /** Hechas en la app. */
  app: number;
  /** Traídas del CRM viejo. */
  legacy: number;
};

/** Un técnico con su volumen. Solo existe del lado app (A114). */
export type InspeccionTecnico = {
  technicianId: string;
  nombre: string;
  rows: number;
  primeraMs: number;
  ultimaMs: number;
  porMes: { yearMonth: string; rows: number }[];
};

export type InspeccionesPanel = {
  /** Revisiones que pasan los filtros. */
  total: number;
  /** Total sin filtros — el ancla contra la que se compara. */
  totalHistorico: number;
  conFiltros: boolean;
  deLaApp: number;
  delHistorico: number;
  porMes: InspeccionMes[];
  porTecnico: InspeccionTecnico[];
  /** Las del CRM viejo: nunca se va a saber quién las hizo. */
  sinTecnico: number;
  /** Las que sí se pueden atribuir — el denominador honesto de `porTecnico`. */
  atribuibles: number;
  note: string;
};
