"use client";

import { LeadsDashboard } from "@/components/bi/LeadsDashboard";
import type {
  ConversionFunnel,
  ConvertedLead,
  LeadsPorRevisar,
  LeadsStats,
  LeadSinLlave,
  LeadTelefonoRaro,
  MatchesStats,
} from "@/components/bi/types";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Datos de MUESTRA (no salen de Convex).
 *
 * Los agregados sí copian los de producción —8.706 leads, 180 conversiones,
 * 2,07%, 31 sin llave, 152 teléfonos inservibles— porque el punto de esta vista
 * es revisar el diseño con las magnitudes reales: una conversión del 2% se ve
 * muy distinta a una del 30%, y una lista de 152 filas se pagina distinto que
 * una de 5.
 *
 * Los nombres, teléfonos e IDs, en cambio, son **inventados**: esta vista no
 * pide sesión y las tablas muestran datos de clientes.
 *
 * Todo se genera con una semilla fija: la vista tiene que verse idéntica en
 * cada carga, si no no se puede aprobar un diseño contra ella.
 */
const D = (iso: string) => Date.parse(`${iso}T00:00:00-06:00`);

/** PRNG determinista (mulberry32). Sin esto la muestra cambiaría en cada render. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMBRES = [
  "Marisol Vargas", "Rodolfo Chinchilla", "Kimberly Solano", "Álvaro Zamora",
  "Douglas Arias Mora", "Natalia Fonseca", "Wilberth Núñez", "Sofía Ledezma",
  "Esteban Rojas Ureña", "Gabriela Mena", "Jean Carlo Umaña", "Adriana Picado",
  "Marvin Quesada", "Yendry Alfaro", "Randall Sequeira", "Priscilla Blanco",
  "Óscar Villalobos", "Tatiana Cordero", "Luis Diego Brenes", "Karla Jiménez",
  "Fabián Retana", "Hazel Montero", "Josué Barrantes", "Melissa Chacón",
];

const MONTOS = [40_000, 45_000, 50_000, 55_000, 59_000, 65_000, 68_850, 72_500];

const ID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** IDs con la misma pinta que los de Airtable (`rec` + 14). */
function fakeAirtableId(r: () => number) {
  let s = "rec";
  for (let i = 0; i < 14; i++) s += ID_CHARS[Math.floor(r() * ID_CHARS.length)];
  return s;
}

/**
 * Los 180 que convirtieron. El corte por banda no es inventado: sale de los
 * métodos del embudo (152 por teléfono exacto = alta, 28 desempatados = media).
 * El reparto app/histórico sí es una aproximación razonable para el diseño.
 */
const CONVERTED: ConvertedLead[] = (() => {
  const r = rng(20260811);
  const inicio = D("2025-05-10");
  const fin = D("2026-08-07");
  return Array.from({ length: 180 }, (_, i) => {
    const ms = inicio + Math.floor(r() * (fin - inicio));
    const iso = new Date(ms).toISOString().slice(0, 10);
    return {
      // Una de cada 15 sin nombre: pasa de verdad y la tabla lo tiene que resolver.
      leadName: i % 15 === 7 ? undefined : NOMBRES[i % NOMBRES.length],
      phone8: String(60_000_000 + Math.floor(r() * 29_999_999)),
      inspectionDate: iso,
      amountCRC: MONTOS[Math.floor(r() * MONTOS.length)],
      confidenceBand: i < 152 ? "alta" : "media",
      matchTarget: i % 10 < 7 ? "legacy" : "era_app",
    };
  }).sort((a, b) => (a.inspectionDate < b.inspectionDate ? 1 : -1));
})();

const POR_REVISAR: LeadsPorRevisar = (() => {
  const r = rng(915);
  const inicio = D("2025-11-20");
  const fin = D("2026-08-07");
  const fecha = () => inicio + Math.floor(r() * (fin - inicio));

  // 18 leads caen en las dos listas (un PSID no sirve de teléfono y además
  // deja al lead sin llave). Es justo lo que hace que 183 avisos sean 165
  // leads, así que la muestra tiene que reproducirlo.
  const compartidos = Array.from({ length: 18 }, () => fakeAirtableId(r));

  const sinLlave: LeadSinLlave[] = Array.from({ length: 31 }, (_, i) => ({
    airtableId: compartidos[i] ?? fakeAirtableId(r),
    // Casi la mitad sin nombre: un lead sin llave suele venir sin nada más.
    name: i % 2 === 0 ? undefined : NOMBRES[(i * 3) % NOMBRES.length],
    leadStage: "nuevo",
    sourceCreatedAt: fecha(),
  }));

  const prefijosNoCr = ["1", "34", "56", "51", "502", "503", "505", "507", "829"];
  const telefonoRaro: LeadTelefonoRaro[] = Array.from({ length: 152 }, (_, i) => {
    const psid = i < 54;
    return {
      airtableId: psid && i < 18 ? compartidos[i] : fakeAirtableId(r),
      name: i % 20 === 3 ? undefined : NOMBRES[(i * 7) % NOMBRES.length],
      rawPhone: psid
        ? String(Math.floor(r() * 9e13) + 1e13)
        : prefijosNoCr[i % prefijosNoCr.length] +
          String(30_000_000 + Math.floor(r() * 60_000_000)),
      motivo: psid ? "psid" : "no_cr",
      sourceCreatedAt: fecha(),
    };
  });

  const recientes = <T extends { sourceCreatedAt?: number }>(a: T, b: T) =>
    (b.sourceCreatedAt ?? 0) - (a.sourceCreatedAt ?? 0);

  return {
    sinLlave: sinLlave.sort(recientes),
    telefonoRaro: telefonoRaro.sort(recientes),
  };
})();

const FUNNEL: ConversionFunnel = {
  leadsTotal: 8706,
  leadsWithPhone: 8639,
  leadsMatched: 238,
  converted: 180,
  convertedRatePct: 2.07,
  convertedRateOfPhonedPct: 2.08,
  possibleAdditionalByName: 58,
  possibleAdditionalByNameRatePct: 0.67,
  convertedIncludingName: 238,
  placeholderMatches: 0,
  byBand: [
    { band: "alta", rows: 152 },
    { band: "media", rows: 28 },
    { band: "baja", rows: 58 },
  ],
  byMethod: [
    { method: "phone_exact", rows: 152 },
    { method: "phone_vehicle_window", rows: 28 },
    { method: "name_vehicle_window", rows: 58 },
  ],
  byTarget: [
    { target: "legacy", rows: 155 },
    { target: "era_app", rows: 83 },
  ],
  // La portada ya no pinta la muestra: la lista completa vive en su tarjeta.
  sampleWhoConverts: [],
  note: "channel no está disponible en leads (Airtable vacío); sin desglose por canal del lado lead.",
};

const MATCHES: MatchesStats = {
  totalMatches: 238,
  ambiguous: 28,
  validIncome: 238,
  invalidIncome: 0,
  byMatchKeyKind: [
    { kind: "phone", rows: 180 },
    { kind: "name", rows: 58 },
  ],
  byMethod: FUNNEL.byMethod,
  byBand: FUNNEL.byBand,
  byTarget: FUNNEL.byTarget,
  leadsWithPhone: 8639,
  leadsWithoutMatch: 8468,
  ambiguousMatchIssues: 28,
};

const LEADS: LeadsStats = {
  total: 8706,
  isDeleted: 0,
  phone8Present: 8639,
  manychatPresent: 8232,
  namePresent: 8527,
  phoneValidTrue: 8541,
  phoneValidFalse: 165,
  dupPhone8Groups: 476,
  dupPhone8ExcessRows: 507,
  dupManychatGroups: 371,
  dupManychatExcessRows: 391,
  minSourceCreatedAt: D("2025-11-20"),
  maxSourceCreatedAt: D("2026-08-08"),
  sourceCreatedPresent: 8706,
  byStage: [
    { stage: "nuevo", rows: 8526 },
    { stage: "convertido", rows: 180 },
  ],
  byChannel: [{ channel: "(vacío)", rows: 8706 }],
  issuesByType: [
    { issueType: "lead_dup", rows: 1745 },
    { issueType: "anomalous_phone", rows: 152 },
    { issueType: "lead_no_key", rows: 31 },
  ],
};

export function LeadsPreview() {
  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — datos de muestra, nombres,
        teléfonos e IDs inventados. No existe en producción.
      </div>
      {/* Acá no hay shell de /admin, así que este envoltorio hace su papel:
          aplica el tema grafito y el mismo padding de contenido. */}
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <LeadsDashboard
          funnel={FUNNEL}
          matches={MATCHES}
          leads={LEADS}
          porRevisar={POR_REVISAR}
          converted={CONVERTED}
        />
      </div>
    </>
  );
}
