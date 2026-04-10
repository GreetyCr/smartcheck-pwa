import type { CountryOriginKey, DraftEngineUi } from "@/types/inspection-draft";

export function normalizePlate(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidPlate(value: string): boolean {
  const p = normalizePlate(value);
  if (p.length < 2) return false;
  return /^[A-Z0-9-]+$/.test(p);
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

export function normalizeVin(value: string): string {
  return value.trim().toUpperCase();
}

/** VIN opcional: vacío válido; si hay texto deben ser 17 caracteres alfanuméricos. */
export function isValidVinOptional(vin: string): boolean {
  const v = normalizeVin(vin);
  if (v.length === 0) return true;
  return /^[A-Z0-9]{17}$/.test(v);
}

export function parseMileageKm(value: string): number | null {
  const n = Number.parseInt(value.trim(), 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

export function draftEngineToConvex(
  ui: DraftEngineUi,
): "gasolina" | "electrico" {
  return ui === "electrico" ? "electrico" : "gasolina";
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
  { value: "estados_unidos", label: "Estados Unidos" },
  { value: "corea", label: "Corea" },
  { value: "japon", label: "Japón" },
  { value: "alemania", label: "Alemania" },
  { value: "mexico", label: "México" },
  { value: "otro", label: "Otro" },
];
