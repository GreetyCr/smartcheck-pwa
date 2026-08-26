/**
 * F3 · Capa de métricas de consumo — queries que alimentan los tableros BI.
 *
 * Todo `internalQuery` de SOLO LECTURA (excepciones acotadas: `flagReconciliationGap`
 * y `flagUnmappedProvinces`, `internalMutation` que SOLO escriben en `bi_quality_issues`
 * —log de calidad, tabla aditiva del BI—; JAMÁS tocan `inspections`/`inspections_legacy`,
 * de solo lectura, RNF-01). Cálculo en memoria (dato diminuto). MODELO-DATOS §5 y §8.
 *
 * Vista unificada `inspections_all` (§8 + A30): **UNIÓN + DEDUPE**, ya NO corte duro.
 *   - Incluye TODO `inspections_legacy` ∪ TODO `inspections` era-app.
 *   - Dedupe de solapes reales (misma inspección en ambas fuentes): match por
 *     `phone8` (si existe) o nombre+fecha±ventana+vehículo → se cuenta 1 sola vez;
 *     en el solape **era-app es la autoritativa** (registro oficial de la PWA).
 *   - Excluye filas de prueba/junk: nombre "Test", teléfono 55555555, monto ₡0.
 *     Los placeholders de ₡1000 SÍ cuentan como revisión (inspección real, monto
 *     placeholder) pero NO aportan ingreso.
 *
 * Normalización de dimensiones (A31, NO destructiva; solo en la capa de vista):
 *   - `province`: texto libre del CRM → 7 provincias CR (o "Desconocido").
 *   - `engineType`: texto libre → Gasolina / Diésel / Híbrido / Eléctrico / Otro.
 *
 * Convenciones: todo monto en ₡ (A16); canal = `captureSource` (era-app) + `channel`
 * del CRM (legacy), NUNCA del lado lead (A8/A19); `yearMonth` en zona CR (lib/dates).
 *
 * Filtros globales opcionales (RF-02): `{fromMs?, toMs?, province?, engineType?, channel?}`.
 * SOLO DEV en este WP.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { yearMonth as ymFromMs, isoDate } from "./lib/dates";

/* -------------------------------------------------------------------------- */
/* Constantes                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Corte histórico del §8 (A18). A partir de A30 la vista `inspections_all` ya NO
 * usa corte duro (usa unión + dedupe). Se conserva SOLO para `cutoverDiagnostic`
 * (mide el solape que el corte descartaba).
 */
const CUTOVER_MS = Date.parse("2026-07-01T00:00:00-06:00");

/** Inicio de cobertura del Sheet financiero. Antes de esto no hay finanzas → el gap
 * de conciliación sería espurio (inspecciones sin contraparte financiera). */
const FINANCE_START_MS = Date.parse("2025-07-01T00:00:00-06:00");

/** Umbral de gap de conciliación "significativo": 5% del ingreso del periodo. */
const RECON_GAP_PCT_THRESHOLD = 5;

/** Ventana para considerar "la misma inspección" en el dedupe de solapes. */
const DEDUPE_WINDOW_MS = 7 * 24 * 3600 * 1000;

/** Provincia canónica para lo no mapeable. */
const PROVINCE_UNKNOWN = "Desconocido";
/** Motor canónico para lo no reconocible. */
const ENGINE_OTHER = "Otro";

/* -------------------------------------------------------------------------- */
/* Helpers de normalización de texto                                          */
/* -------------------------------------------------------------------------- */

/** minúsculas, sin acentos, guiones bajos→espacio, espacios colapsados. */
function norm(s: string | undefined | null): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Últimos 8 dígitos CR; null si placeholder/anómalo. */
function last8(raw: string | undefined | null): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  const p = d.slice(-8);
  return p === "00000000" ? null : p;
}

/* -------------------------------------------------------------------------- */
/* A31 · Normalizador de PROVINCIA (texto libre CRM → 7 provincias)           */
/* -------------------------------------------------------------------------- */

/**
 * Tabla ordenada de keywords (ya normalizadas, sin acentos) → provincia. Se
 * escanea EN ORDEN; el primer keyword contenido en el texto gana. Orden pensado
 * para desambiguar: frases específicas primero, luego cantones/distritos únicos
 * de cada provincia, y al final un fallback de agencias sin ubicación (por su
 * sede). Muchos valores del CRM son nombres de agencia con la ubicación anexa,
 * así que la búsqueda por substring resuelve la mayoría.
 */
const PROVINCE_KEYWORDS: Array<[string[], string]> = [
  // -- Frases de desambiguación explícita (antes que los tokens simples) --
  [["san jose de la montana"], "Heredia"],
  [["san francisco de dos rios", "san francisco de 2 rios", "francisco de 2 rios", "san francisco de dos rio"], "San José"],
  [["san francisco de heredia", "san francisco heredia", "zmotor san francisco"], "Heredia"],
  [["san isidro de heredia", "san isidro heredia"], "Heredia"],
  [["san rafael de montes de oca", "san rafael abajo"], "San José"],
  [["san rafael de heredia", "heredia san rafael"], "Heredia"],
  // -- Heredia --
  [
    [
      "heredia", "belen", "santo domingo", "barva", "santa barbara", "cariari",
      "afz", "mercedes norte", "tierras del cafe", "san joaquin", "san pablo",
      "flores", "ulloa",
    ],
    "Heredia",
  ],
  // -- Cartago --
  [
    [
      "cartago", "tres rios", "tres rio", "la union", "concepcion la union",
      "el tejar", "orosi", "dulce nombre", "guarco", "paraiso", "turrialba",
    ],
    "Cartago",
  ],
  // -- Alajuela --
  [
    [
      "alajuela", "grecia", "naranjo", "san carlos", "san ramon", "poas",
      "guacima", "carrillos", "tambor", "florencia", "invu", "sarchi",
      "atenas", "novazul",
    ],
    "Alajuela",
  ],
  // -- Guanacaste / Puntarenas / Limón --
  [["guanacaste", "liberia", "nicoya", "santa cruz", "canas", "tamarindo", "filadelfia"], "Guanacaste"],
  [["puntarenas", "jaco", "quepos", "esparza", "miramar", "parrita"], "Puntarenas"],
  [["limon", "guapiles", "siquirres", "pococi", "pocora", "matina"], "Limón"],
  // -- San José --
  [
    [
      "san jose", "escazu", "santa ana", "curridabat", "curridabst", "curri",
      "guadalupe", "uruca", "moravia", "rohmoser", "rohrmoser", "coronado",
      "sabana", "sabanilla", "lindora", "tibas", "pavas", "aserri",
      "san sebastian", "san pedro", "zapote", "desamparados", "ciudad colon",
      "calle blancos", "guayabos", "pinares", "mata platano", "granadilla",
      "montes de oca", "dos rios", "alajuelita", "hatillo", "plaza viquez",
      "goicochea", "goicoechea", "pozos", "sesa",
    ],
    "San José",
  ],
  // -- Fallback: agencias sin ubicación explícita, por su sede conocida (SJ) --
  [
    [
      "danissa", "danisa", "dannissa", "veinsa", "carsot", "carasot", "koreautos",
      "koreauto", "kautos", "jarcar", "red motor", "red motos", "quality motors",
      "quality motor", "grupo q", "faco", "ambacar", "pz motors", "pzmotors",
    ],
    "San José",
  ],
];

/** Normaliza una provincia de texto libre a una de las 7 provincias CR o "Desconocido". */
function normalizeProvince(raw: string | undefined | null): string {
  const t = norm(raw);
  if (!t) return PROVINCE_UNKNOWN;
  for (const [keys, prov] of PROVINCE_KEYWORDS) {
    for (const k of keys) {
      if (t.includes(norm(k))) return prov;
    }
  }
  return PROVINCE_UNKNOWN;
}

/* -------------------------------------------------------------------------- */
/* A31 · Normalizador de TIPO DE MOTOR (texto libre → canónico)               */
/* -------------------------------------------------------------------------- */

/**
 * Canónico: Gasolina / Diésel / Híbrido / Eléctrico / Otro. Quita cilindraje
 * ("Gasolina 2.0" → "Gasolina"), unifica "Diésel"/"Diesel", detecta híbridos
 * (gasolina+eléctrico) y LP/gas → "Otro". Devuelve undefined si el raw está
 * ausente/vacío (se muestra como "(sin motor)"), "Otro" si presente-pero-raro.
 */
function normalizeEngine(raw: string | undefined | null): string | undefined {
  const t = norm(raw);
  if (!t) return undefined;
  const hasGasolina = t.includes("gasolina");
  const hasElectric = t.includes("electric") || t.includes("electrico");
  const hasHybrid = t.includes("hibrid") || t.includes("hibri");
  // Híbrido: marca explícita, o gasolina + eléctrico juntos.
  if (hasHybrid || (hasGasolina && hasElectric)) return "Híbrido";
  if (hasElectric) return "Eléctrico";
  if (t.includes("diesel") || t.includes("diese") || t.includes("duramax"))
    return "Diésel";
  // "Gas LP" / "Gas 1.6" (gas sin gasolina) → Otro. "Gasolina y gas, LP" → Gasolina.
  if (hasGasolina) return "Gasolina";
  return ENGINE_OTHER; // presente pero no reconocible (gas LP, números, "motor 1.8", etc.)
}

/* -------------------------------------------------------------------------- */
/* A32 · Clasificar ubicación del CRM: PROVINCIA vs AGENCIA vs junk            */
/* -------------------------------------------------------------------------- */

/**
 * B26: Esteban usa el campo "Provincia"/Ubicación del CRM también para anotar el
 * nombre de la AGENCIA/comercio donde revisó el carro (para contar revisiones por
 * agencia). Por eso separamos:
 *   - provincia/localidad CR  → provincia (San José, Heredia, …)
 *   - nombre de agencia/comercio → dimensión `byAgency`; en el eje provincia = "En agencia"
 *   - vacío / basura ("0","135","-") → "Desconocido" (único que se flagea)
 */
const PROVINCE_IN_AGENCY = "En agencia";

/** Marcadores de "esto es un comercio/agencia" (substrings normalizados). */
const AGENCY_MARKERS = [
  "auto", "motor", "garage", "garaje", "seminuevos", "usados", "renta", "rent ",
  "importad", "comercial", "agencia", "grupo", "premium", "luxury", "elite",
  "prestige", "swap", "quality", "vehiculos", "concesionaria", "dealer",
  // cadenas conocidas sin marcador genérico:
  "veinsa", "danissa", "danisa", "dannissa", "carsot", "carasot", "koreauto",
  "kautos", "jarcar", "faco", "ambacar", "purdy", "villamotors", "villa motors",
  "zmotor", "farah", "corimotors", "starcars", "fabro", "carswap", "kardon",
  "natura", "avis", "tqc", "goi cars", "top cars", "chito cars", "anc",
  "star cars", "ticocar", "kia motors", "bmw uruca", "pz motors", "pzmotors",
  "casa conde", "koreautos",
];

/** ¿La ubicación es sólo vacío/número/basura? */
function isJunkLocation(raw: string | undefined | null): boolean {
  const t = norm(raw);
  if (t === "" || t === "-") return true;
  if (/^[\d.,\s-]+$/.test(t)) return true; // "0", "135", "49000", "69.357"
  return false;
}

/** ¿La ubicación parece nombre de agencia/comercio? */
function isAgencyLocation(raw: string | undefined | null): boolean {
  const t = norm(raw);
  if (/\bcars?\b/.test(t)) return true; // "cars", "car" como palabra (no "cartago"/"cariari")
  for (const m of AGENCY_MARKERS) if (t.includes(m)) return true;
  return false;
}

/** Canonicaliza el nombre de agencia (colapsa variantes de las cadenas frecuentes). */
function canonicalAgency(raw: string): string {
  const t = norm(raw);
  const map: Array<[string[], string]> = [
    [["danissa", "danisa", "dannissa"], "Danissa"],
    [["veinsa"], "VEINSA"],
    [["carsot", "carasot"], "Carsot"],
    [["koreauto"], "Koreautos"],
    [["zmotor"], "ZMotors"],
    [["quality motor"], "Quality Motors"],
    [["red moto"], "Red Motors"],
    [["grupo q"], "Grupo Q"],
    [["purdy"], "Purdy"],
    [["garage 46", "garaje 46", "garaje, 46", "garage, 46", "garaje46", "garage46"], "Autos Garage 46"],
    [["ceroestres", "cero estres", "ceroestress", "cero estress"], "Autos Ceroestres"],
    [["autoxperience", "auto experience", "autoexperience"], "AutoXperience"],
    [["auto time", "autotime"], "Auto Time"],
    [["farah"], "Farah"],
    [["motores britanicos"], "Motores Británicos"],
    [["villamotors", "villa motors"], "VillaMotors"],
    [["ambacar"], "Ambacar"],
    [["jarcar"], "Jarcar"],
    [["faco"], "FACO"],
    [["avis"], "Avis"],
    [["top cars"], "Top Cars"],
    [["goi cars"], "Goi Cars"],
    [["luxury car"], "Luxury Car"],
    [["pz motors", "pzmotors", "pz  motors"], "PZ Motors"],
    [["koreautos"], "Koreautos"],
  ];
  for (const [keys, label] of map) {
    for (const k of keys) if (t.includes(k)) return label;
  }
  // sin cadena conocida: usar el crudo original (trim + espacios colapsados).
  return String(raw).replace(/\s+/g, " ").trim();
}

/** Clasifica la ubicación cruda → { province (etiqueta), agency? }. */
function classifyLocation(raw: string | undefined | null): {
  province: string;
  agency?: string;
} {
  if (isJunkLocation(raw)) return { province: PROVINCE_UNKNOWN };
  if (isAgencyLocation(raw))
    return { province: PROVINCE_IN_AGENCY, agency: canonicalAgency(String(raw)) };
  const prov = normalizeProvince(raw);
  if (prov !== PROVINCE_UNKNOWN) return { province: prov };
  // No es lugar reconocido ni basura → Esteban anotó una agencia sin marcador (B26).
  return { province: PROVINCE_IN_AGENCY, agency: canonicalAgency(String(raw)) };
}

/* -------------------------------------------------------------------------- */
/* A34 · Unificar CANAL a un solo vocabulario title-case                      */
/* -------------------------------------------------------------------------- */

/**
 * Fusiona `Fuente` del CRM (Mercadeo/Publicidad/Referido/…) y
 * `captureSource` de era-app (minúscula) en un eje único:
 * Mercadeo / TikTok / Buscador / Recompra / Referido / Otro. undefined si vacío.
 */
function normalizeChannel(raw: string | undefined | null): string | undefined {
  const t = norm(raw);
  if (!t) return undefined;
  if (t.includes("tiktok") || t.includes("tik tok") || t === "tik") return "TikTok";
  if (t.includes("mercadeo") || t.includes("publicidad")) return "Mercadeo";
  if (t.includes("buscador") || t.includes("google")) return "Buscador";
  if (t.includes("recompra")) return "Recompra";
  if (t.includes("referido")) return "Referido";
  return "Otro";
}

/* -------------------------------------------------------------------------- */
/* Vista unificada `inspections_all` (helper compartido, A30)                 */
/* -------------------------------------------------------------------------- */

/** Fila normalizada de la vista unificada (§8, A30/A31). */
type UnifiedRow = {
  date: number; // epoch ms CR
  amountCRC: number | undefined;
  isPlaceholderIncome: boolean; // amount === 1000 → cuenta como revisión, sin ingreso
  province: string; // etiqueta: 7 provincias CR | "En agencia" | "Desconocido" (A32)
  agency: string | undefined; // nombre de agencia si la ubicación era un comercio (A32)
  engineType: string | undefined; // NORMALIZADO (canónico) o undefined si sin dato
  channel: string | undefined; // CANAL unificado title-case (A34)
  source: "legacy" | "era_app";
};

/** Fila rica intermedia (con identidad para dedupe). */
type RichRow = UnifiedRow & {
  name: string; // normalizado
  phone8: string | null;
  brand: string; // normalizado
};

type FilterArgs = {
  fromMs?: number;
  toMs?: number;
  province?: string;
  engineType?: string;
  channel?: string;
};

export const filterValidator = {
  fromMs: v.optional(v.number()),
  toMs: v.optional(v.number()),
  province: v.optional(v.string()),
  engineType: v.optional(v.string()),
  channel: v.optional(v.string()),
};

/** ¿la fila pasa los filtros? (periodo semiabierto [from, to); dims normalizadas). */
function passesFilters(r: UnifiedRow, f: FilterArgs): boolean {
  if (f.fromMs != null && r.date < f.fromMs) return false;
  if (f.toMs != null && r.date >= f.toMs) return false;
  if (f.province != null && norm(r.province) !== norm(f.province)) return false;
  if (f.engineType != null && norm(r.engineType) !== norm(f.engineType))
    return false;
  if (f.channel != null && norm(r.channel) !== norm(f.channel)) return false;
  return true;
}

/** ¿fila de prueba/junk? (nombre "Test", teléfono 55555555, monto ₡0). */
function isJunk(name: string, phoneDigits: string, amount: number | undefined): boolean {
  if (norm(name) === "test") return true;
  if (phoneDigits === "55555555") return true;
  if (amount === 0) return true;
  return false;
}

/**
 * Construye la vista unificada `inspections_all` (A30): UNIÓN de legacy ∪ era-app,
 * junk excluido, solapes deduplicados (era-app autoritativa). Devuelve también las
 * cuentas de diagnóstico.
 */
export async function buildInspectionsAll(ctx: { db: any }): Promise<{
  all: UnifiedRow[];
  diag: {
    legacyRaw: number;
    eraRaw: number;
    junkExcludedLegacy: number;
    junkExcludedEra: number;
    dupSuperseded: number; // filas legacy suprimidas por solape con era-app
  };
}> {
  // --- 1. Cargar era-app (autoritativa en solapes) ---
  const eraRich: RichRow[] = [];
  let eraRaw = 0;
  let junkExcludedEra = 0;
  for (const r of await ctx.db.query("inspections").collect()) {
    eraRaw++;
    const date = r.inspectionStartAt ?? r._creationTime;
    const amount = r.totalAmountCharged ?? undefined;
    const phoneDigits = String(r.clientPhone ?? "").replace(/\D/g, "");
    if (isJunk(r.clientName ?? "", phoneDigits, amount)) {
      junkExcludedEra++;
      continue;
    }
    const eraLoc = classifyLocation(r.province ?? undefined);
    eraRich.push({
      date,
      amountCRC: amount,
      isPlaceholderIncome: amount === 1000,
      province: eraLoc.province,
      agency: eraLoc.agency,
      engineType: normalizeEngine(r.engineType),
      channel: normalizeChannel(r.captureSource),
      source: "era_app",
      name: norm(r.clientName),
      phone8: last8(r.clientPhone),
      brand: norm(r.vehicleBrand),
    });
  }

  // --- 2. Cargar legacy ---
  const legacyRich: RichRow[] = [];
  let legacyRaw = 0;
  let junkExcludedLegacy = 0;
  for (const r of await ctx.db.query("inspections_legacy").collect()) {
    legacyRaw++;
    const amount = r.amountCRC ?? undefined;
    const phoneDigits = String(r.phone8 ?? "").replace(/\D/g, "");
    if (isJunk(r.clientName ?? "", phoneDigits, amount)) {
      junkExcludedLegacy++;
      continue;
    }
    const legLoc = classifyLocation(r.province ?? undefined);
    legacyRich.push({
      date: r.inspectionDate,
      amountCRC: amount,
      isPlaceholderIncome: amount === 1000,
      province: legLoc.province,
      agency: legLoc.agency,
      engineType: normalizeEngine(r.engineType),
      channel: normalizeChannel(r.channel),
      source: "legacy",
      name: norm(r.clientName),
      phone8: last8(r.phone8),
      brand: norm(r.vehicleBrand),
    });
  }

  // --- 3. Dedupe de solapes: marcar legacy que sea "la misma" que una era-app ---
  const legacySuperseded = new Set<number>(); // índices en legacyRich
  for (const e of eraRich) {
    let matchIdx = -1;
    for (let i = 0; i < legacyRich.length; i++) {
      if (legacySuperseded.has(i)) continue;
      const l = legacyRich[i];
      // fuerte: mismo phone8
      if (e.phone8 && l.phone8 && e.phone8 === l.phone8) {
        matchIdx = i;
        break;
      }
      // débil: nombre igual + fecha en ventana + vehículo compatible
      if (
        e.name &&
        e.name === l.name &&
        Math.abs(e.date - l.date) <= DEDUPE_WINDOW_MS &&
        (!e.brand || !l.brand || e.brand === l.brand)
      ) {
        matchIdx = i;
        break;
      }
    }
    if (matchIdx >= 0) legacySuperseded.add(matchIdx);
  }

  const strip = (r: RichRow): UnifiedRow => ({
    date: r.date,
    amountCRC: r.amountCRC,
    isPlaceholderIncome: r.isPlaceholderIncome,
    province: r.province,
    agency: r.agency,
    engineType: r.engineType,
    channel: r.channel,
    source: r.source,
  });

  const all: UnifiedRow[] = [
    ...eraRich.map(strip),
    ...legacyRich.filter((_, i) => !legacySuperseded.has(i)).map(strip),
  ];

  return {
    all,
    diag: {
      legacyRaw,
      eraRaw,
      junkExcludedLegacy,
      junkExcludedEra,
      dupSuperseded: legacySuperseded.size,
    },
  };
}

/** Agrupa filas por una clave string → [{key, rows, amountCRC}] ordenado. */
function groupBy(
  rows: UnifiedRow[],
  keyOf: (r: UnifiedRow) => string,
  sortByKey = false,
): { key: string; rows: number; amountCRC: number }[] {
  const m = new Map<string, { rows: number; amountCRC: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    const g = m.get(k) ?? { rows: 0, amountCRC: 0 };
    g.rows++;
    g.amountCRC += r.amountCRC ?? 0;
    m.set(k, g);
  }
  const arr = [...m.entries()].map(([key, g]) => ({
    key,
    rows: g.rows,
    amountCRC: g.amountCRC,
  }));
  arr.sort((a, b) => (sortByKey ? a.key.localeCompare(b.key) : b.rows - a.rows));
  return arr;
}

/** Total de filas que NO son placeholder de ingreso (₡1000). */
const countNoPlaceholder = (rows: UnifiedRow[]) =>
  rows.filter((r) => !r.isPlaceholderIncome).length;

/* -------------------------------------------------------------------------- */
/* 1. inspectionsAll — vista unificada normalizada (conteos + muestra)         */
/* -------------------------------------------------------------------------- */

export const inspectionsAll = internalQuery({
  args: { ...filterValidator, sampleSize: v.optional(v.number()) },
  returns: v.object({
    counts: v.object({
      unifiedTotal: v.number(), // |inspections_all| tras filtros (con placeholders)
      unifiedTotalNoFilter: v.number(),
      unifiedSinPlaceholder: v.number(), // sin las filas ₡1000
      placeholderRows: v.number(),
      legacyRaw: v.number(),
      eraRaw: v.number(),
      junkExcluded: v.number(),
      dupSuperseded: v.number(),
    }),
    withAmount: v.number(),
    totalAmountCRC: v.number(),
    sample: v.array(
      v.object({
        dateISO: v.string(),
        amountCRC: v.optional(v.number()),
        province: v.string(),
        agency: v.optional(v.string()),
        engineType: v.optional(v.string()),
        channel: v.optional(v.string()),
        source: v.string(),
      }),
    ),
    note: v.string(),
  }),
  handler: async (ctx, args) => {
    const built = await buildInspectionsAll(ctx);
    const filtered = built.all.filter((r) => passesFilters(r, args));
    let withAmount = 0;
    let totalAmountCRC = 0;
    let placeholderRows = 0;
    for (const r of filtered) {
      if (r.isPlaceholderIncome) placeholderRows++;
      if (r.amountCRC !== undefined) {
        withAmount++;
        totalAmountCRC += r.amountCRC;
      }
    }
    const n = args.sampleSize ?? 5;
    const sample = [...filtered]
      .sort((a, b) => b.date - a.date)
      .slice(0, n)
      .map((r) => ({
        dateISO: isoDate(r.date),
        amountCRC: r.amountCRC,
        province: r.province,
        agency: r.agency,
        engineType: r.engineType,
        channel: r.channel,
        source: r.source,
      }));
    return {
      counts: {
        unifiedTotal: filtered.length,
        unifiedTotalNoFilter: built.all.length,
        unifiedSinPlaceholder: countNoPlaceholder(filtered),
        placeholderRows,
        legacyRaw: built.diag.legacyRaw,
        eraRaw: built.diag.eraRaw,
        junkExcluded:
          built.diag.junkExcludedLegacy + built.diag.junkExcludedEra,
        dupSuperseded: built.diag.dupSuperseded,
      },
      withAmount,
      totalAmountCRC,
      sample,
      note: "inspections_all (A30) = UNIÓN legacy ∪ era-app, junk excluido (Test/55555555/₡0), solapes deduplicados (era-app autoritativa). Placeholders ₡1000 cuentan como revisión pero no aportan ingreso.",
    };
  },
});

/* -------------------------------------------------------------------------- */
/* 2. totalRevisiones — conteo + desgloses normalizados (con filtros)          */
/* -------------------------------------------------------------------------- */

/** Forma de retorno de `totalRevisiones` — la reusa el wrapper público (`bi/public.ts`). */
export const totalRevisionesReturns = v.object({
    total: v.number(), // con placeholders (todas las revisiones reales)
    totalSinPlaceholder: v.number(), // excluye ₡1000
    placeholderRows: v.number(),
    byMonth: v.array(
      v.object({ key: v.string(), rows: v.number(), amountCRC: v.number() }),
    ),
    byProvince: v.array(
      v.object({ key: v.string(), rows: v.number(), amountCRC: v.number() }),
    ),
    byAgency: v.array(
      v.object({ key: v.string(), rows: v.number(), amountCRC: v.number() }),
    ),
    agencyDistinct: v.number(),
    byEngineType: v.array(
      v.object({ key: v.string(), rows: v.number(), amountCRC: v.number() }),
    ),
    byChannel: v.array(
      v.object({ key: v.string(), rows: v.number(), amountCRC: v.number() }),
    ),
    bySource: v.array(
      v.object({ key: v.string(), rows: v.number(), amountCRC: v.number() }),
    ),
});

export const totalRevisiones = internalQuery({
  args: { ...filterValidator },
  returns: totalRevisionesReturns,
  handler: async (ctx, args) =>
    computeTotalRevisiones(await buildInspectionsAll(ctx), args),
});

/**
 * Cómputo PURO de `totalRevisiones` (recibe la vista ya construida). Lo comparten
 * la `internalQuery` de arriba —que usa el CLI, sin auth— y la query pública del
 * tablero, que gatea con `requireAdmin`: en Convex una `query` no puede
 * `ctx.runQuery` (A41), así que el cálculo tiene que vivir fuera de ambas.
 */
export function computeTotalRevisiones(
  built: Awaited<ReturnType<typeof buildInspectionsAll>>,
  args: FilterArgs,
) {
    const rows = built.all.filter((r) => passesFilters(r, args));
    let placeholderRows = 0;
    for (const r of rows) if (r.isPlaceholderIncome) placeholderRows++;
    // byAgency: solo filas cuya ubicación era una agencia (A32).
    const agencyRows = rows.filter((r) => r.agency !== undefined);
    const byAgency = groupBy(agencyRows, (r) => r.agency as string);
    return {
      total: rows.length,
      totalSinPlaceholder: countNoPlaceholder(rows),
      placeholderRows,
      byMonth: groupBy(rows, (r) => ymFromMs(r.date), true),
      byProvince: groupBy(rows, (r) => r.province),
      byAgency,
      agencyDistinct: byAgency.length,
      byEngineType: groupBy(rows, (r) => r.engineType ?? "(sin motor)"),
      byChannel: groupBy(rows, (r) => r.channel ?? "(sin canal)"),
      bySource: groupBy(rows, (r) => r.source),
    };
}

/* -------------------------------------------------------------------------- */
/* 3. financeSummary — ingresos/gastos/utilidad por mes (finance_entries, ₡)   */
/* -------------------------------------------------------------------------- */

/** Validador de salida de `financeSummary` (compartido con el wrapper público `bi/public.ts`). */
export const financeSummaryReturns = v.object({
  months: v.array(
    v.object({
      yearMonth: v.string(),
      rows: v.number(),
      income: v.number(),
      expense: v.number(),
      utilidad: v.number(),
      marginPct: v.number(),
    }),
  ),
  totals: v.object({
    rows: v.number(),
    income: v.number(),
    expense: v.number(),
    utilidad: v.number(),
    marginPct: v.number(),
    viaticoCount: v.number(),
    viaticoAmountCRC: v.number(),
  }),
});

/**
 * Cómputo PURO de `financeSummary` (sin Convex): recibe las filas ya leídas de
 * `finance_entries` y devuelve la serie mensual + totales. Se comparte entre la
 * `internalQuery` y el wrapper público (`bi/public.ts`) porque en Convex una
 * `query` no puede `ctx.runQuery` (A41). Excluye `isDeleted`.
 */
export function computeFinanceSummary(
  rows: Doc<"finance_entries">[],
  fromMs?: number,
  toMs?: number,
) {
  const byMonth = new Map<
    string,
    { rows: number; income: number; expense: number }
  >();
  let viaticoCount = 0;
  let viaticoAmountCRC = 0;
  for (const r of rows) {
    if (r.isDeleted) continue;
    if (fromMs != null && r.date < fromMs) continue;
    if (toMs != null && r.date >= toMs) continue;
    if (r.isViatico) {
      viaticoCount++;
      viaticoAmountCRC += r.amountCRC;
    }
    const m = byMonth.get(r.yearMonth) ?? { rows: 0, income: 0, expense: 0 };
    m.rows++;
    if (r.kind === "income") m.income += r.amountCRC;
    else m.expense += r.amountCRC;
    byMonth.set(r.yearMonth, m);
  }
  const pct = (util: number, inc: number) =>
    inc > 0 ? Math.round((util / inc) * 10000) / 100 : 0;
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, m]) => ({
      yearMonth,
      rows: m.rows,
      income: m.income,
      expense: m.expense,
      utilidad: m.income - m.expense,
      marginPct: pct(m.income - m.expense, m.income),
    }));
  const t = months.reduce(
    (acc, m) => ({
      rows: acc.rows + m.rows,
      income: acc.income + m.income,
      expense: acc.expense + m.expense,
    }),
    { rows: 0, income: 0, expense: 0 },
  );
  const utilidad = t.income - t.expense;
  return {
    months,
    totals: {
      rows: t.rows,
      income: t.income,
      expense: t.expense,
      utilidad,
      marginPct: pct(utilidad, t.income),
      viaticoCount,
      viaticoAmountCRC,
    },
  };
}

export const financeSummary = internalQuery({
  args: { fromMs: v.optional(v.number()), toMs: v.optional(v.number()) },
  returns: financeSummaryReturns,
  handler: async (ctx, { fromMs, toMs }) => {
    const rows = await ctx.db.query("finance_entries").collect();
    return computeFinanceSummary(rows, fromMs, toMs);
  },
});

/* -------------------------------------------------------------------------- */
/* 4. reconciliation — ingreso por inspecciones vs ingreso financiero          */
/* -------------------------------------------------------------------------- */

/**
 * Concilia, por periodo (yearMonth ≥ jul-2025, donde el Sheet financiero tiene
 * cobertura — A30), el Σ `amountCRC` de `inspections_all` contra el ingreso
 * financiero de `finance_entries` (kind="income"). Los meses previos a jul-2025
 * se EXCLUYEN (gap espurio: hay inspecciones legacy pero no finanzas). SOLO
 * LECTURA; el flag `reconciliation_gap` lo persiste `flagReconciliationGap`.
 */
/** Forma de retorno de la conciliación — la reusa el wrapper público (`bi/public.ts`). */
export const reconciliationReturns = v.object({
    months: v.array(
      v.object({
        yearMonth: v.string(),
        inspectionsIncome: v.number(),
        inspectionsCount: v.number(),
        financeIncome: v.number(),
        gapAbs: v.number(),
        gapPct: v.number(),
        significant: v.boolean(),
        /**
         * Mes en curso: la revisión se cuenta cuando se HACE y el ingreso
         * cuando se ENTREGA el informe (que es cuando se pagó, B27.2). Así que
         * el mes vivo siempre muestra gap negativo y **no es una anomalía**.
         * Se rotula en vez de excluirse: el dato se ve, la alarma no salta.
         */
        enCurso: v.boolean(),
        /** Revisiones del mes sin informe entregado — explica el gap del mes en curso. */
        sinEntregar: v.optional(v.number()),
        /**
         * El mes tiene al menos un ingreso capturado **por el sistema** al
         * entregar el informe (`source: "inspection"`).
         *
         * Sin esto el tablero no puede decir lo único que hace útil a esta
         * conciliación: **el gap de un mes capturado a mano y el de uno
         * capturado solo no significan lo mismo**. En el primero mide el
         * desfase entre dos registros independientes (CRM contra hoja de
         * cálculo); en el segundo, el ingreso que de verdad no viene de una
         * revisión. Comparar los dos como si fueran el mismo indicador es
         * exactamente el error que este tablero existe para evitar.
         */
        autoCaptura: v.boolean(),
      }),
    ),
    totals: v.object({
      inspectionsIncome: v.number(),
      financeIncome: v.number(),
      gapAbs: v.number(),
      gapPct: v.number(),
      significant: v.boolean(),
      gapAbsMesesCerrados: v.number(),
      gapPctMesesCerrados: v.number(),
    }),
    thresholdPct: v.number(),
    financeStartISO: v.string(),
    /**
     * Primer mes con ingreso capturado por el sistema, o `null` si todavía no
     * hay ninguno. Es la línea que parte la serie en dos regímenes de lectura.
     */
    primerMesAutoCaptura: v.union(v.string(), v.null()),
  note: v.string(),
});

export const reconciliation = internalQuery({
  args: { fromMs: v.optional(v.number()), toMs: v.optional(v.number()) },
  returns: reconciliationReturns,
  handler: async (ctx, args) => reconciliationImpl(ctx, args),
});

/**
 * Conciliación, como función plana que recibe `ctx`. A diferencia de
 * `computeTotalRevisiones` no puede ser pura: lee tres tablas (la vista unificada,
 * `finance_entries` y `inspections` para el mes en curso). Compartida entre la
 * `internalQuery` y la query pública del tablero — A41 prohíbe `ctx.runQuery`,
 * no llamar a un helper.
 */
export async function reconciliationImpl(
  ctx: QueryCtx,
  { fromMs, toMs }: { fromMs?: number; toMs?: number },
) {
    const from = Math.max(fromMs ?? FINANCE_START_MS, FINANCE_START_MS);
    const built = await buildInspectionsAll(ctx);
    const inRange = (d: number) => d >= from && (toMs == null || d < toMs);

    const insByMonth = new Map<string, { income: number; count: number }>();
    for (const r of built.all) {
      if (!inRange(r.date)) continue;
      const ym = ymFromMs(r.date);
      const g = insByMonth.get(ym) ?? { income: 0, count: 0 };
      g.income += r.amountCRC ?? 0;
      g.count++;
      insByMonth.set(ym, g);
    }

    const finByMonth = new Map<string, number>();
    /**
     * Meses con al menos un ingreso capturado por el sistema.
     *
     * Se marca el mes **si tiene aunque sea uno**, no si son mayoría: el corte
     * de F5-auto fue por fecha de entrega y sin backfill (B27.1), así que el
     * mes del cambio viene mezclado. Un umbral de mayoría dejaría ese mes
     * rotulado como manual y borraría justo la frontera que interesa ver.
     */
    const mesesAutoCaptura = new Set<string>();
    for (const r of await ctx.db.query("finance_entries").collect()) {
      if (r.isDeleted || r.kind !== "income") continue;
      if (!inRange(r.date)) continue;
      finByMonth.set(r.yearMonth, (finByMonth.get(r.yearMonth) ?? 0) + r.amountCRC);
      if (r.source === "inspection") mesesAutoCaptura.add(r.yearMonth);
    }

    const allMonths = new Set([...insByMonth.keys(), ...finByMonth.keys()]);
    const pct = (gap: number, fin: number) =>
      fin > 0 ? Math.round((gap / fin) * 10000) / 100 : gap === 0 ? 0 : 100;

    // Mes vivo: sus revisiones ya están hechas pero muchas aún no se entregan,
    // así que su ingreso todavía no existe. Se cuenta cuántas faltan para poder
    // explicarlo con un número en vez de con una excusa.
    const mesEnCurso = ymFromMs(Date.now());
    let sinEntregarMesEnCurso = 0;
    for (const r of await ctx.db.query("inspections").collect()) {
      const d = r.inspectionStartAt ?? r._creationTime;
      if (ymFromMs(d) !== mesEnCurso) continue;
      if (r.status !== "report_delivered") sinEntregarMesEnCurso++;
    }

    const months = [...allMonths]
      .sort((a, b) => a.localeCompare(b))
      .map((ym) => {
        const ins = insByMonth.get(ym) ?? { income: 0, count: 0 };
        const fin = finByMonth.get(ym) ?? 0;
        const gapAbs = fin - ins.income;
        const gapPct = pct(gapAbs, fin);
        const enCurso = ym === mesEnCurso;
        return {
          yearMonth: ym,
          inspectionsIncome: ins.income,
          inspectionsCount: ins.count,
          financeIncome: fin,
          gapAbs,
          gapPct,
          // El mes en curso nunca se marca significativo: su gap es el desfase
          // normal entre hacer el trabajo y cobrarlo, no una inconsistencia.
          significant: !enCurso && Math.abs(gapPct) >= RECON_GAP_PCT_THRESHOLD,
          enCurso,
          sinEntregar: enCurso ? sinEntregarMesEnCurso : undefined,
          autoCaptura: mesesAutoCaptura.has(ym),
        };
      });

    const insTot = months.reduce((s, m) => s + m.inspectionsIncome, 0);
    const finTot = months.reduce((s, m) => s + m.financeIncome, 0);
    const gapTot = finTot - insTot;
    const gapTotPct = pct(gapTot, finTot);

    // El mes en curso arrastra el agregado (su ingreso todavía no ocurrió), así
    // que se ofrecen las dos cifras: la total y la comparable. Ninguna se
    // esconde — el tablero decide cuál titula y cuál pone al lado.
    const cerrados = months.filter((m) => !m.enCurso);
    const insCerr = cerrados.reduce((s, m) => s + m.inspectionsIncome, 0);
    const finCerr = cerrados.reduce((s, m) => s + m.financeIncome, 0);
    const gapCerr = finCerr - insCerr;

    return {
      months,
      totals: {
        inspectionsIncome: insTot,
        financeIncome: finTot,
        gapAbs: gapTot,
        gapPct: gapTotPct,
        significant: Math.abs(gapTotPct) >= RECON_GAP_PCT_THRESHOLD,
        /** Mismo cálculo sin el mes en curso: la cifra comparable mes a mes. */
        gapAbsMesesCerrados: gapCerr,
        gapPctMesesCerrados: pct(gapCerr, finCerr),
      },
      thresholdPct: RECON_GAP_PCT_THRESHOLD,
      financeStartISO: isoDate(FINANCE_START_MS),
      primerMesAutoCaptura:
        months.find((m) => m.autoCaptura)?.yearMonth ?? null,
      note: "Solo periodo ≥ jul-2025 (cobertura del Sheet financiero). inspectionsIncome = Σ amountCRC de inspections_all (unión+dedupe). financeIncome = finance_entries kind=income. Gap esperado ≠ 0 y se cuantifica, no se anula. Cambia de significado según el periodo: hasta jul-2026 mide fuentes independientes (CRM vs Sheet) con desfases de registro; desde la auto-captura (F5-auto) el ingreso de la inspección entregada ya entra solo, así que el gap pasa a medir el ingreso NO explicado por una inspección (venta de reportes, adicionales — A33). Los dos lados se fechan distinto a propósito: la inspección por su fecha de realización y el ingreso por la de entrega/pago, que es cuando el dinero entró (mediana 1,2 días de diferencia; solo cruzan de mes los casos de fin de mes). EL MES EN CURSO (`enCurso:true`) SE ROTULA, NO SE EXCLUYE: sus revisiones ya se hicieron pero muchas aún no se entregan, así que su ingreso todavía no existe y el gap negativo es normal — `sinEntregar` dice cuántas faltan. Nunca se marca `significant` ni genera issue. Para comparar mes a mes, usar `gapPctMesesCerrados`.",
    };
}

/**
 * Persiste (idempotente) el flag `reconciliation_gap` en `bi_quality_issues` para
 * los meses (≥ jul-2025) con gap significativo. SOLO escribe en el log de calidad
 * del BI; NUNCA toca inspections/legacy/finance. Idempotente: resetea sus propios
 * issues y reinserta.
 */
export const flagReconciliationGap = internalMutation({
  args: {
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    runId: v.optional(v.string()),
  },
  returns: v.object({ cleared: v.number(), flagged: v.number(), months: v.array(v.string()) }),
  handler: async (ctx, { fromMs, toMs, runId }) => {
    const now = Date.now();
    const rid = runId ?? `recon:${now}`;
    const from = Math.max(fromMs ?? FINANCE_START_MS, FINANCE_START_MS);

    let cleared = 0;
    for (const it of await ctx.db.query("bi_quality_issues").collect()) {
      if (it.issueType === "reconciliation_gap") {
        await ctx.db.delete(it._id);
        cleared++;
      }
    }

    const built = await buildInspectionsAll(ctx);
    const inRange = (d: number) => d >= from && (toMs == null || d < toMs);
    const insByMonth = new Map<string, number>();
    for (const r of built.all) {
      if (!inRange(r.date)) continue;
      const ym = ymFromMs(r.date);
      insByMonth.set(ym, (insByMonth.get(ym) ?? 0) + (r.amountCRC ?? 0));
    }
    const finByMonth = new Map<string, number>();
    for (const r of await ctx.db.query("finance_entries").collect()) {
      if (r.isDeleted || r.kind !== "income") continue;
      if (!inRange(r.date)) continue;
      finByMonth.set(r.yearMonth, (finByMonth.get(r.yearMonth) ?? 0) + r.amountCRC);
    }
    const allMonths = new Set([...insByMonth.keys(), ...finByMonth.keys()]);

    let flagged = 0;
    const months: string[] = [];
    // El mes en curso queda fuera del flag: su gap es el desfase normal entre
    // hacer la revisión y cobrarla, no una inconsistencia. Sin esto, cada
    // corrida abriría un issue del mes vivo que se cierra solo al mes siguiente.
    const mesEnCurso = ymFromMs(Date.now());
    for (const ym of [...allMonths].sort()) {
      if (ym === mesEnCurso) continue;
      const ins = insByMonth.get(ym) ?? 0;
      const fin = finByMonth.get(ym) ?? 0;
      const gapAbs = fin - ins;
      const gapPct = fin > 0 ? (gapAbs / fin) * 100 : gapAbs === 0 ? 0 : 100;
      if (Math.abs(gapPct) >= RECON_GAP_PCT_THRESHOLD) {
        await ctx.db.insert("bi_quality_issues", {
          issueType: "reconciliation_gap",
          severity: "warn",
          entity: "finance_entries",
          entityRef: ym,
          detail: `gap ${ym}: finance=₡${Math.round(fin)} vs inspecciones=₡${Math.round(ins)} → Δ₡${Math.round(gapAbs)} (${Math.round(gapPct * 100) / 100}%)`,
          runId: rid,
          detectedAt: now,
          resolved: false,
        });
        flagged++;
        months.push(ym);
      }
    }
    return { cleared, flagged, months };
  },
});

/* -------------------------------------------------------------------------- */
/* 5. executiveSummary — números titulares del tablero Resumen                 */
/* -------------------------------------------------------------------------- */

/** Forma de retorno del resumen ejecutivo — la reusa el wrapper público (`bi/public.ts`). */
export const executiveSummaryReturns = v.object({
    totalRevisiones: v.number(), // con placeholders
    totalRevisionesSinPlaceholder: v.number(),
    placeholderRows: v.number(),
    revisionesConMonto: v.number(),
    ingresosInspeccionesCRC: v.number(),
    ingresosFinancierosCRC: v.number(),
    gastosCRC: v.number(),
    utilidadCRC: v.number(),
    marginPct: v.number(),
    leadsTotal: v.number(),
    leadsWithPhone: v.number(),
    convertidos: v.number(),
    conversionPct: v.number(),
    conversionPctOfPhoned: v.number(),
    leadToClientePct: v.number(),
    note: v.string(),
});

export const executiveSummary = internalQuery({
  args: { ...filterValidator },
  returns: executiveSummaryReturns,
  handler: async (ctx, args) => executiveSummaryImpl(ctx, args),
});

/**
 * Resumen ejecutivo, como función plana que recibe `ctx` (lee la vista unificada,
 * finanzas y matches). Compartida por la `internalQuery` y la query pública del
 * tablero — ver la nota de `computeTotalRevisiones` sobre A41.
 */
export async function executiveSummaryImpl(ctx: QueryCtx, args: FilterArgs) {
    const built = await buildInspectionsAll(ctx);
    const insRows = built.all.filter((r) => passesFilters(r, args));
    let revisionesConMonto = 0;
    let ingresosInspecciones = 0;
    let placeholderRows = 0;
    for (const r of insRows) {
      if (r.isPlaceholderIncome) placeholderRows++;
      if (r.amountCRC !== undefined) {
        revisionesConMonto++;
        ingresosInspecciones += r.amountCRC;
      }
    }

    let income = 0;
    let expense = 0;
    for (const r of await ctx.db.query("finance_entries").collect()) {
      if (r.isDeleted) continue;
      if (args.fromMs != null && r.date < args.fromMs) continue;
      if (args.toMs != null && r.date >= args.toMs) continue;
      if (r.kind === "income") income += r.amountCRC;
      else expense += r.amountCRC;
    }
    const utilidad = income - expense;

    const leads = await ctx.db.query("leads_contacts").collect();
    const leadsTotal = leads.filter((l: any) => !l.isDeleted).length;
    const leadsWithPhone = leads.filter(
      (l: any) => !l.isDeleted && l.phone8,
    ).length;
    let convertidos = 0;
    for (const m of await ctx.db.query("bi_matches").collect()) {
      if (m.validIncome && m.confidenceBand !== "baja") convertidos++;
    }
    const pct = (x: number, d: number) =>
      d > 0 ? Math.round((x / d) * 10000) / 100 : 0;

    return {
      totalRevisiones: insRows.length,
      totalRevisionesSinPlaceholder: countNoPlaceholder(insRows),
      placeholderRows,
      revisionesConMonto,
      ingresosInspeccionesCRC: ingresosInspecciones,
      ingresosFinancierosCRC: income,
      gastosCRC: expense,
      utilidadCRC: utilidad,
      marginPct: pct(utilidad, income),
      leadsTotal,
      leadsWithPhone,
      convertidos,
      conversionPct: pct(convertidos, leadsTotal),
      conversionPctOfPhoned: pct(convertidos, leadsWithPhone),
      leadToClientePct: pct(convertidos, leadsTotal),
      note: "Revisiones = inspections_all (unión+dedupe, A30). Ingresos titulares = finance_entries (P&L oficial, A16). Conversión titular = bi_matches banda alta+media (A29).",
    };
}

/* -------------------------------------------------------------------------- */
/* 6. cutoverDiagnostic — solape entre era-app y legacy (contexto histórico)   */
/* -------------------------------------------------------------------------- */

/**
 * Diagnóstico del solape era-app ↔ legacy alrededor del antiguo corte 2026-07-01
 * (A30 ya lo reemplazó por unión+dedupe; esto queda como contexto). Reporta
 * cuántas era-app duplican una legacy (por phone8 / nombre+fecha) vs. son únicas.
 */
export const cutoverDiagnostic = internalQuery({
  args: { windowDays: v.optional(v.number()) },
  returns: v.object({
    cutoverISO: v.string(),
    eraAppTotal: v.number(),
    eraAppBeforeCutover: v.number(),
    eraAppFromCutover: v.number(),
    legacyBeforeCutover: v.number(),
    legacyFromCutover: v.number(),
    dupOfLegacy: v.number(),
    uniqueVsLegacy: v.number(),
    dupByPhone: v.number(),
    dupByNameDate: v.number(),
    windowDays: v.number(),
    samplesUnique: v.array(
      v.object({
        dateISO: v.string(),
        clientName: v.optional(v.string()),
        phone8: v.optional(v.string()),
        amountCRC: v.optional(v.number()),
      }),
    ),
    samplesDup: v.array(
      v.object({
        dateISO: v.string(),
        clientName: v.optional(v.string()),
        phone8: v.optional(v.string()),
        matchedBy: v.string(),
      }),
    ),
    note: v.string(),
  }),
  handler: async (ctx, { windowDays }) => {
    const win = (windowDays ?? 7) * 24 * 3600 * 1000;
    const legacyRows = await ctx.db.query("inspections_legacy").collect();
    const legacyPhones = new Set<string>();
    const legacyByName = new Map<string, number[]>();
    let legacyBeforeCutover = 0;
    let legacyFromCutover = 0;
    for (const r of legacyRows) {
      if (r.inspectionDate < CUTOVER_MS) legacyBeforeCutover++;
      else legacyFromCutover++;
      const p = last8(r.phone8);
      if (p) legacyPhones.add(p);
      const nm = norm(r.clientName);
      if (nm) {
        const a = legacyByName.get(nm) ?? [];
        a.push(r.inspectionDate);
        legacyByName.set(nm, a);
      }
    }

    const eraRows = await ctx.db.query("inspections").collect();
    let eraAppTotal = 0;
    let eraAppBeforeCutover = 0;
    let eraAppFromCutover = 0;
    let dupOfLegacy = 0;
    let uniqueVsLegacy = 0;
    let dupByPhone = 0;
    let dupByNameDate = 0;
    const samplesUnique: any[] = [];
    const samplesDup: any[] = [];

    for (const r of eraRows) {
      eraAppTotal++;
      const date = r.inspectionStartAt ?? r._creationTime;
      if (date >= CUTOVER_MS) eraAppFromCutover++;
      else eraAppBeforeCutover++;

      const p = last8(r.clientPhone);
      const nm = norm(r.clientName);
      let matchedBy = "";
      if (p && legacyPhones.has(p)) {
        matchedBy = "phone8";
        dupByPhone++;
      } else if (nm && legacyByName.has(nm)) {
        const dates = legacyByName.get(nm)!;
        if (dates.some((d) => Math.abs(d - date) <= win)) {
          matchedBy = "name+date";
          dupByNameDate++;
        }
      }
      if (matchedBy) {
        dupOfLegacy++;
        if (samplesDup.length < 10)
          samplesDup.push({
            dateISO: isoDate(date),
            clientName: r.clientName,
            phone8: p ?? undefined,
            matchedBy,
          });
      } else {
        uniqueVsLegacy++;
        if (samplesUnique.length < 10)
          samplesUnique.push({
            dateISO: isoDate(date),
            clientName: r.clientName,
            phone8: p ?? undefined,
            amountCRC: r.totalAmountCharged ?? undefined,
          });
      }
    }

    return {
      cutoverISO: isoDate(CUTOVER_MS),
      eraAppTotal,
      eraAppBeforeCutover,
      eraAppFromCutover,
      legacyBeforeCutover,
      legacyFromCutover,
      dupOfLegacy,
      uniqueVsLegacy,
      dupByPhone,
      dupByNameDate,
      windowDays: windowDays ?? 7,
      samplesUnique,
      samplesDup,
      note: "Contexto (A30 reemplazó el corte por unión+dedupe): 'uniqueVsLegacy' son era-app sin contraparte legacy (ya cuentan en inspections_all); 'dupOfLegacy' son solapes deduplicados (la legacy se suprime, gana era-app).",
    };
  },
});

/* -------------------------------------------------------------------------- */
/* A31 · Auditoría/flag de provincias sin mapear (info)                        */
/* -------------------------------------------------------------------------- */

/**
 * Recorre legacy+era-app y marca (idempotente) en `bi_quality_issues` SOLO las
 * ubicaciones verdaderamente vacías/basura ("0", "135", "-", en blanco) que caen
 * en "Desconocido" (A32: los nombres de agencia YA no son basura, son dato válido
 * en `byAgency`). SOLO escribe en el log de calidad. No flaggea engineType (no
 * reconocidos → "Otro", categoría válida).
 */
export const flagUnmappedProvinces = internalMutation({
  args: { runId: v.optional(v.string()) },
  returns: v.object({
    cleared: v.number(),
    flagged: v.number(),
    distinctUnmapped: v.number(),
    rowsUnmapped: v.number(),
    samples: v.array(v.object({ raw: v.string(), rows: v.number() })),
  }),
  handler: async (ctx, { runId }) => {
    const now = Date.now();
    const rid = runId ?? `provmap:${now}`;

    let cleared = 0;
    for (const it of await ctx.db.query("bi_quality_issues").collect()) {
      if (it.issueType === "unmapped_province") {
        await ctx.db.delete(it._id);
        cleared++;
      }
    }

    const unmapped = new Map<string, number>();
    const scan = (
      rawProvince: string | undefined,
      amount: number | undefined,
      name: string,
      phoneDigits: string,
    ) => {
      if (isJunk(name, phoneDigits, amount)) return;
      const raw = String(rawProvince ?? "").trim();
      // A32: solo la basura real cae en "Desconocido"; las agencias son válidas.
      if (classifyLocation(raw).province === PROVINCE_UNKNOWN) {
        const key = raw === "" ? "(vacío)" : raw;
        unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
      }
    };
    for (const r of await ctx.db.query("inspections_legacy").collect()) {
      scan(
        r.province,
        r.amountCRC ?? undefined,
        r.clientName ?? "",
        String(r.phone8 ?? "").replace(/\D/g, ""),
      );
    }
    for (const r of await ctx.db.query("inspections").collect()) {
      scan(
        r.province ?? undefined,
        r.totalAmountCharged ?? undefined,
        r.clientName ?? "",
        String(r.clientPhone ?? "").replace(/\D/g, ""),
      );
    }

    let flagged = 0;
    let rowsUnmapped = 0;
    for (const [raw, rows] of unmapped) {
      rowsUnmapped += rows;
      await ctx.db.insert("bi_quality_issues", {
        issueType: "unmapped_province",
        severity: "info",
        entity: "inspections_legacy",
        entityRef: raw,
        detail: `provincia sin mapear → "${PROVINCE_UNKNOWN}" (${rows} fila[s])`,
        runId: rid,
        detectedAt: now,
        resolved: false,
      });
      flagged++;
    }

    const samples = [...unmapped.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([raw, rows]) => ({ raw, rows }));

    return { cleared, flagged, distinctUnmapped: unmapped.size, rowsUnmapped, samples };
  },
});
