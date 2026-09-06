/**
 * Marca del vehículo, unificada entre las dos fuentes (**RF-02**).
 *
 * ## El problema
 *
 * Las dos plataformas guardan la marca de forma incompatible:
 *
 *  - **La app** tiene una lista cerrada de 14 opciones (`Hyundai`, `Toyota`,
 *    …, `Otro`). Limpia.
 *  - **El CRM viejo** tiene **texto libre con marca, modelo y año pegados**:
 *    «Hyundai Tucson 2017», «Toyota Rav4», «Honda CRV». En producción eran
 *    **530 valores distintos para 742 filas** al 25-ago-2026.
 *
 * Un filtro por marca sobre cientos de opciones no es un filtro. Y quedarse solo
 * con la app dejaría fuera **la mayor parte del histórico**: las filas del CRM
 * viejo son 741 de 912 al 6-set-2026, y ese reparto casi no se mueve porque el
 * histórico está congelado.
 *
 * ## Qué hace este módulo
 *
 * Toma el **primer token** del texto y lo resuelve contra un mapa escrito a
 * mano. Los 71 tokens distintos que hay hoy en producción se revisaron uno por
 * uno; el mapa cubre tres casos que el texto libre produjo de verdad:
 *
 *  1. **Erratas**: `hyudai`, `hyudnai`, `mitusbishi`, `chevolet`, `chevorlet`,
 *     `for`, `gilly`, `izusu`.
 *  2. **Marcas de dos palabras**, resueltas por su primera palabra: `land` y
 *     `range` → Land Rover, `great` → Great Wall.
 *  3. **Modelos escritos sin la marca**: `tucson`, `creta`, `santa`, `elantra`
 *     y `avante` son Hyundai; `vitara` es Suzuki; `terios`, Daihatsu;
 *     `outlander`, Mitsubishi; `captiva`, Chevrolet; `mustang`, Ford; `dmax`,
 *     Isuzu. Son ~13 filas que si no se resuelven quedan sin marca.
 *
 * ## Lo que NO se intenta adivinar
 *
 * Lo que no calza queda en **`SIN_MARCA`**, que es un valor visible del filtro
 * y no un descarte silencioso. Hoy caen ahí las filas donde alguien anotó una
 * placa (`BYQ946`), la transmisión (`automatico`) o nada. Es la regla de A64:
 * **el hueco tiene que poder contarse**. Si mañana entra una marca nueva y no
 * está en el mapa, va a aparecer en «Sin marca» con su cuenta, en vez de
 * repartirse en silencio entre las demás.
 */

/** Valor visible para lo que no se pudo resolver. Nunca se esconde. */
export const SIN_MARCA = "(sin marca)";

/**
 * Primer token → marca canónica.
 *
 * Las claves van **normalizadas** (minúscula, sin tildes, sin puntuación); las
 * escribe `normalizarToken`. Los valores son la etiqueta que ve Esteban.
 */
const MAPA: Record<string, string> = {
  // --- marcas tal cual ---
  hyundai: "Hyundai",
  toyota: "Toyota",
  nissan: "Nissan",
  suzuki: "Suzuki",
  kia: "Kia",
  mitsubishi: "Mitsubishi",
  bmw: "BMW",
  mazda: "Mazda",
  honda: "Honda",
  audi: "Audi",
  chevrolet: "Chevrolet",
  ford: "Ford",
  geely: "Geely",
  volkswagen: "Volkswagen",
  vw: "Volkswagen",
  jeep: "Jeep",
  lexus: "Lexus",
  mercedes: "Mercedes-Benz",
  daihatsu: "Daihatsu",
  citroen: "Citroën",
  subaru: "Subaru",
  mini: "MINI",
  volvo: "Volvo",
  mg: "MG",
  dodge: "Dodge",
  renault: "Renault",
  chery: "Chery",
  changan: "Changan",
  peugeot: "Peugeot",
  ssangyong: "SsangYong",
  fiat: "Fiat",
  byd: "BYD",
  jetour: "Jetour",
  jmc: "JMC",
  isuzu: "Isuzu",
  hino: "Hino",
  jac: "JAC",
  seat: "Seat",
  porsche: "Porsche",
  land: "Land Rover",
  otro: "Otro",

  // --- erratas vistas en producción ---
  hyudai: "Hyundai",
  hyudnai: "Hyundai",
  hiunday: "Hyundai",
  mitusbishi: "Mitsubishi",
  chevolet: "Chevrolet",
  chevorlet: "Chevrolet",
  for: "Ford",
  gilly: "Geely",
  izusu: "Isuzu",
  ssanyong: "SsangYong",
  toyata: "Toyota",

  // --- marcas de dos palabras, mapeadas por su primera ---
  range: "Land Rover",
  great: "Great Wall",

  // --- modelos escritos sin la marca ---
  tucson: "Hyundai",
  creta: "Hyundai",
  santa: "Hyundai",
  elantra: "Hyundai",
  avante: "Hyundai",
  accent: "Hyundai",
  vitara: "Suzuki",
  jimny: "Suzuki",
  terios: "Daihatsu",
  outlander: "Mitsubishi",
  montero: "Mitsubishi",
  captiva: "Chevrolet",
  mustang: "Ford",
  dmax: "Isuzu",
  rav4: "Toyota",
  corolla: "Toyota",
  hilux: "Toyota",
  sportage: "Kia",
  sorento: "Kia",
  crv: "Honda",
};

/** Minúscula, sin tildes, sin puntuación, espacios colapsados. */
function normalizarToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Texto libre → marca canónica, o `SIN_MARCA` si no se reconoce.
 *
 * **Mira solo la primera palabra**, y las marcas de dos palabras se resuelven
 * mapeando esa primera: `land` y `range` → Land Rover, `great` → Great Wall.
 * Es más simple que buscar pares y da el mismo resultado, porque en este
 * conjunto ninguna primera palabra pertenece a dos marcas distintas.
 */
export function canonicalBrand(raw: string | undefined | null): string {
  const t = normalizarToken(String(raw ?? ""));
  if (!t) return SIN_MARCA;
  return MAPA[t.split(" ")[0]] ?? SIN_MARCA;
}
