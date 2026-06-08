import type {
  CountryOriginKey,
  DraftCombustionFuel,
  DraftEngineCategory,
} from "@/types/inspection-draft";

export type ConvexEngineType =
  | "gasolina"
  | "diesel"
  | "gas_lp"
  | "electrico"
  | "hibrido";

/** ISO 3779: sin I, O, Q para evitar confusiones. */
const VIN_BODY = "[A-HJ-NPR-Z0-9]{17}";

/** Solo letras y números, mayúsculas (para validar longitud de placa). */
export function plateAlphanumericCore(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function normalizePlate(value: string): string {
  return value.trim().toUpperCase();
}

/** Placa costarricense típica: 6 a 8 caracteres alfanuméricos (sin contar guiones). */
export function isValidPlateCr(value: string): boolean {
  const core = plateAlphanumericCore(value);
  return /^[A-Z0-9]{6,8}$/.test(core);
}

export function normalizeVin(value: string): string {
  return value.trim().toUpperCase();
}

/** VIN vacío válido; si hay texto deben ser 17 caracteres válidos según ISO 3779. */
export function isValidVinOptional17(vin: string): boolean {
  const v = normalizeVin(vin);
  if (v.length === 0) return true;
  return new RegExp(`^${VIN_BODY}$`).test(v);
}

/** Año con exactamente 4 dígitos, entre 1990 y año actual + 1. */
export function parseYear(value: string): number | null {
  const t = value.trim();
  if (!/^\d{4}$/.test(t)) return null;
  const y = Number.parseInt(t, 10);
  if (Number.isNaN(y)) return null;
  const max = new Date().getFullYear() + 1;
  if (y < 1990 || y > max) return null;
  return y;
}

export function parseMileage(value: string): number | null {
  const n = Number.parseInt(value.trim(), 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

export function draftEngineToConvex(params: {
  engineCategory: DraftEngineCategory;
  combustionFuel: DraftCombustionFuel | "";
}): ConvexEngineType {
  if (params.engineCategory === "electrico") return "electrico";
  if (params.engineCategory === "hibrido") return "hibrido";
  const f = params.combustionFuel;
  if (f === "diesel") return "diesel";
  if (f === "gas_lp") return "gas_lp";
  return "gasolina";
}

/** Mapea `engineType` guardado en Convex al estado del formulario. */
export function convexEngineToDraft(
  stored: string | undefined,
): {
  engineCategory: DraftEngineCategory;
  combustionFuel: DraftCombustionFuel | "";
} {
  if (stored === "electrico")
    return { engineCategory: "electrico", combustionFuel: "" };
  if (stored === "hibrido")
    return { engineCategory: "hibrido", combustionFuel: "" };
  if (stored === "diesel")
    return { engineCategory: "combustion", combustionFuel: "diesel" };
  if (stored === "gas_lp")
    return { engineCategory: "combustion", combustionFuel: "gas_lp" };
  if (stored === "gasolina")
    return { engineCategory: "combustion", combustionFuel: "gasolina" };
  return { engineCategory: "combustion", combustionFuel: "" };
}

export const BRAND_OPTIONS: string[] = [
  "Toyota",
  "Nissan",
  "Hyundai",
  "Kia",
  "Honda",
  "Mazda",
  "Mitsubishi",
  "Suzuki",
  "Ford",
  "Chevrolet",
  "Volkswagen",
  "BMW",
  "Mercedes-Benz",
  "Otro",
];

export const COUNTRY_OPTIONS: { value: CountryOriginKey; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "nacional", label: "Nacional" },
  { value: "panama", label: "Panamá" },
  { value: "korea", label: "Korea" },
  { value: "otros", label: "Otros" },
];

/** Prioridad: VIN válido (17 caracteres); si no, placa 6–8. */
export function resolvePrimaryVehicleId(
  plateInput: string,
  vinInput: string,
): {
  identifierType: "vin" | "placa";
  identifier: string;
  vin?: string;
  plateNumber?: string;
} {
  const plateCore = plateAlphanumericCore(plateInput);
  const vinNorm = normalizeVin(vinInput);
  const hasVin = new RegExp(`^${VIN_BODY}$`).test(vinNorm);
  const hasPlate = /^[A-Z0-9]{6,8}$/.test(plateCore);
  if (hasVin) {
    return {
      identifierType: "vin",
      identifier: vinNorm,
      vin: vinNorm,
      plateNumber: hasPlate ? plateCore : undefined,
    };
  }
  if (hasPlate) {
    return {
      identifierType: "placa",
      identifier: plateCore,
    };
  }
  throw new Error(
    "Se requiere VIN (17 caracteres) o placa (6–8 caracteres alfanuméricos).",
  );
}

export function isValidOptionalEmail(raw: string): boolean {
  const t = raw.trim();
  if (t.length === 0) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}
