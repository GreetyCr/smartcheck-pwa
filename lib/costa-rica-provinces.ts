import type { CostaRicaProvinceKey } from "@/types/inspection-draft";

export const COSTA_RICA_PROVINCES: {
  value: CostaRicaProvinceKey;
  label: string;
}[] = [
  { value: "san_jose", label: "San José" },
  { value: "alajuela", label: "Alajuela" },
  { value: "cartago", label: "Cartago" },
  { value: "heredia", label: "Heredia" },
  { value: "guanacaste", label: "Guanacaste" },
  { value: "puntarenas", label: "Puntarenas" },
  { value: "limon", label: "Limón" },
];

export function isCostaRicaProvinceKey(
  value: string | null | undefined,
): value is CostaRicaProvinceKey {
  return COSTA_RICA_PROVINCES.some((p) => p.value === value);
}
