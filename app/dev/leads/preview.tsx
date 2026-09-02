"use client";

import { LeadsDashboard } from "@/components/bi/LeadsDashboard";
import { BotSwitchCard } from "@/components/bi/BotSwitchCard";
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
 * Los agregados sí copian los de producción —**al 1-set-2026**: 9.290 leads,
 * 220 conversiones, 2,37%, 31 sin llave, 166 teléfonos inservibles— porque el
 * punto de esta vista es revisar el diseño con las magnitudes reales: una
 * conversión del 2% se ve muy distinta a una del 30%, y una lista de 166 filas
 * se pagina distinto que una de 5.
 *
 * Llevan la fecha a propósito: son una foto, y sin fecha se leen como si fueran
 * de hoy. Se regeneran con `npx convex run --prod bi/matches:conversionFunnel`
 * y `bi/leads:leadsStats`.
 *
 * `converted`, `recompras` y `porMes` (A112/A113) salen del mismo comando, ya
 * con la función desplegada: PROD devuelve **220 titulares y 16 recompras**,
 * idéntico a lo que se había calculado a mano sobre las tablas antes del
 * despliegue. No recalcular a mano: pedirlos al comando.
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
  leadsTotal: 9290,
  leadsWithPhone: 9218,
  leadsMatched: 295,
  /* Los 9.290 traen `sourceCreatedAt`. El campo existe igual porque el día que
     entre uno sin fecha tiene que verse, no desaparecer del conteo. */
  leadsSinFecha: 0,
  conPeriodo: false,
  recompras: 16,
  converted: 220,
  convertedRatePct: 2.37,
  convertedRateOfPhonedPct: 2.39,
  possibleAdditionalByName: 58,
  possibleAdditionalByNameRatePct: 0.62,
  convertedIncludingName: 278,
  placeholderMatches: 1,
  /**
   * La cohorte real de PROD. Es el argumento entero de A113 en diez filas: el
   * promedio de toda la vida es 2,37% y el último mes cerrado va en 6,23%.
   *
   * Las recompras se concentran en los meses viejos —cuando el histórico del CRM
   * dominaba— así que separarlas **acentúa** la pendiente en vez de suavizarla.
   */
  porMes: [
    { yearMonth: "2025-11", leads: 287, convertidos: 3, recompras: 0, tasaPct: 1.05 },
    { yearMonth: "2025-12", leads: 1233, convertidos: 4, recompras: 1, tasaPct: 0.32 },
    { yearMonth: "2026-01", leads: 1201, convertidos: 8, recompras: 2, tasaPct: 0.67 },
    { yearMonth: "2026-02", leads: 1065, convertidos: 7, recompras: 4, tasaPct: 0.66 },
    { yearMonth: "2026-03", leads: 1090, convertidos: 13, recompras: 4, tasaPct: 1.19 },
    { yearMonth: "2026-04", leads: 938, convertidos: 10, recompras: 1, tasaPct: 1.07 },
    { yearMonth: "2026-05", leads: 909, convertidos: 41, recompras: 1, tasaPct: 4.51 },
    { yearMonth: "2026-06", leads: 872, convertidos: 40, recompras: 2, tasaPct: 4.59 },
    { yearMonth: "2026-07", leads: 892, convertidos: 44, recompras: 1, tasaPct: 4.93 },
    { yearMonth: "2026-08", leads: 803, convertidos: 50, recompras: 0, tasaPct: 6.23 },
  ],
  byBand: [
    { band: "alta", rows: 202 },
    { band: "media", rows: 35 },
    { band: "baja", rows: 58 },
  ],
  byMethod: [
    { method: "phone_exact", rows: 202 },
    { method: "phone_vehicle_window", rows: 35 },
    { method: "name_vehicle_window", rows: 58 },
  ],
  byTarget: [
    { target: "legacy", rows: 155 },
    { target: "era_app", rows: 140 },
  ],
  // La portada ya no pinta la muestra: la lista completa vive en su tarjeta.
  sampleWhoConverts: [],
  note: "El periodo corta por la fecha del LEAD (sourceCreatedAt), no por la de la revisión (A113). channel no está disponible en leads (Airtable vacío en los 9.290). Recompras aparte (A112).",
};

const MATCHES: MatchesStats = {
  totalMatches: 295,
  ambiguous: 35,
  validIncome: 294,
  invalidIncome: 1,
  byMatchKeyKind: [
    { kind: "phone", rows: 237 },
    { kind: "name", rows: 58 },
  ],
  byMethod: FUNNEL.byMethod,
  byBand: FUNNEL.byBand,
  byTarget: FUNNEL.byTarget,
  leadsWithPhone: 9218,
  leadsWithoutMatch: 8995,
  ambiguousMatchIssues: 34,
};

const LEADS: LeadsStats = {
  total: 9290,
  isDeleted: 0,
  phone8Present: 9218,
  manychatPresent: 8816,
  namePresent: 9093,
  phoneValidTrue: 9111,
  phoneValidFalse: 179,
  dupPhone8Groups: 519,
  dupPhone8ExcessRows: 552,
  dupManychatGroups: 413,
  dupManychatExcessRows: 435,
  minSourceCreatedAt: D("2025-11-20"),
  maxSourceCreatedAt: D("2026-08-30"),
  sourceCreatedPresent: 9290,
  /* `convertido` sigue en 236 y no en 220: es una **caché** que escribe el
     rebuild de matches (A29 ya la marca como «no verdad de conversión»), y
     todavía no se ha recorrido con la regla de recompra. No se pinta en ninguna
     tarjeta, así que no contradice nada en pantalla; si algún día se pinta, hay
     que recorrerla primero. */
  byStage: [
    { stage: "nuevo", rows: 9054 },
    { stage: "convertido", rows: 236 },
  ],
  byChannel: [{ channel: "(vacío)", rows: 9290 }],
  issuesByType: [
    { issueType: "lead_dup", rows: 1919 },
    { issueType: "anomalous_phone", rows: 166 },
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
        {/* Los dos estados del on/off juntos: lo que hay que poder aprobar de
            un vistazo es que el aviso de "todavía no surte efecto" se lea antes
            que el interruptor, no después. */}
        <div className="mb-4 grid gap-4 xl:grid-cols-2">
          <BotSwitchCard
            estado={{
              enabled: true,
              updatedAt: null,
              updatedBy: null,
              updatedVia: null,
              note: null,
              isDefault: true,
              apiConectada: false,
            }}
          />
          <BotSwitchCard
            estado={{
              enabled: false,
              updatedAt: Date.parse("2026-08-19T09:30:00-06:00"),
              updatedBy: "user_ejemplo",
              updatedVia: "dashboard",
              note: "pausa por mantenimiento",
              isDefault: false,
              apiConectada: true,
            }}
          />
        </div>
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
