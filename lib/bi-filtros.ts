/**
 * Estado de la barra de filtros global — **RF-02**.
 *
 * ## Por qué vive en la URL y no en un contexto de React
 *
 * Tres razones concretas, no preferencia:
 *
 *  1. **Se puede mandar.** «Mirá esto» con un enlace que ya trae el filtro
 *     puesto es la mitad de para qué sirve un tablero.
 *  2. **Sobrevive al F5.** Un filtro que se pierde al recargar entrena a no
 *     usarlo.
 *  3. **Sobrevive a cambiar de pestaña.** Ir de Resumen a Canales conserva el
 *     periodo y la provincia, que es lo que el requerimiento pide con
 *     «actualiza todos los tableros».
 *
 * ## Lo que NO hace
 *
 * No inventa valores. Un parámetro con una provincia que no existe se pasa tal
 * cual al backend, que simplemente no encuentra filas — y la pantalla muestra
 * cero con el filtro visible arriba, en vez de ignorarlo en silencio y enseñar
 * un total que no corresponde a lo que dice la barra.
 */

/** Presets de periodo. Los mismos que el desglose de gastos, a propósito. */
export const PERIODOS_FILTRO = [
  { key: "todo", label: "Todo" },
  { key: "12m", label: "12 meses", meses: 12 },
  { key: "6m", label: "6 meses", meses: 6 },
  { key: "3m", label: "3 meses", meses: 3 },
  { key: "1m", label: "Este mes", meses: 1 },
] as const;

export type PeriodoFiltroKey = (typeof PERIODOS_FILTRO)[number]["key"];

/** Las dimensiones que la barra sabe manejar, además del periodo. */
export const DIMENSIONES = [
  "channel",
  "province",
  "engineType",
  "agency",
  "brand",
  "sellerType",
  "currency",
] as const;

export type DimensionKey = (typeof DIMENSIONES)[number];

/** Clave corta en la URL para cada dimensión. La URL se lee, así que importa. */
const PARAM: Record<DimensionKey | "periodo", string> = {
  periodo: "p",
  channel: "canal",
  province: "prov",
  engineType: "motor",
  agency: "local",
  brand: "marca",
  sellerType: "vendedor",
  currency: "moneda",
};

export type FiltrosBi = {
  periodo: PeriodoFiltroKey;
} & Partial<Record<DimensionKey, string>>;

/**
 * `[desde, hasta)` de un preset, **alineado al inicio de mes** y en hora de
 * Costa Rica.
 *
 * Alinear no es cosmético: con un corte a «hace 90 días exactos» el mes más
 * viejo entra partido y su caída se lee como una caída del negocio, cuando lo
 * único que pasa es que faltan días. Es la misma decisión que ya tomaba el
 * desglose de gastos.
 */
export function rangoDelFiltro(
  key: PeriodoFiltroKey,
  ahora = Date.now(),
): { fromMs?: number } {
  const preset = PERIODOS_FILTRO.find((p) => p.key === key);
  const meses = preset && "meses" in preset ? preset.meses : undefined;
  if (!meses) return {};
  const d = new Date(ahora);
  const desde = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (meses - 1), 1, 6),
  );
  return { fromMs: desde.getTime() };
}

/** Lee el estado desde los parámetros de la URL. */
export function leerFiltros(sp: URLSearchParams | null): FiltrosBi {
  const out: FiltrosBi = { periodo: "todo" };
  if (!sp) return out;

  const p = sp.get(PARAM.periodo);
  if (p && PERIODOS_FILTRO.some((x) => x.key === p)) {
    out.periodo = p as PeriodoFiltroKey;
  }
  for (const dim of DIMENSIONES) {
    const v = sp.get(PARAM[dim]);
    if (v) out[dim] = v;
  }
  return out;
}

/** Escribe el estado como parámetros, omitiendo lo que está en su valor neutro. */
export function escribirFiltros(f: FiltrosBi): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.periodo !== "todo") sp.set(PARAM.periodo, f.periodo);
  for (const dim of DIMENSIONES) {
    const v = f[dim];
    if (v) sp.set(PARAM[dim], v);
  }
  return sp;
}

/**
 * Estado → argumentos de Convex, **recortados a lo que la pantalla honra**.
 *
 * `soporta` es la lista de dimensiones que la query de esa pantalla acepta de
 * verdad. Mandar una que no acepta haría que Convex rechace la llamada; y
 * mandarla a una que la ignora sería peor todavía — la barra diría «Heredia» y
 * los números serían de todo el país (A64). Así que se recorta acá y la barra
 * marca en pantalla las que no aplican.
 */
export function argsDeFiltros(
  f: FiltrosBi,
  soporta: readonly (DimensionKey | "periodo")[],
  ahora = Date.now(),
): Record<string, string | number> {
  const args: Record<string, string | number> = {};
  if (soporta.includes("periodo")) {
    const { fromMs } = rangoDelFiltro(f.periodo, ahora);
    if (fromMs != null) args.fromMs = fromMs;
  }
  for (const dim of DIMENSIONES) {
    if (!soporta.includes(dim)) continue;
    const v = f[dim];
    if (v) args[dim] = v;
  }
  return args;
}

/** Cuántos filtros hay puestos (sin contar el periodo en «Todo»). */
export function contarActivos(f: FiltrosBi): number {
  let n = f.periodo === "todo" ? 0 : 1;
  for (const dim of DIMENSIONES) if (f[dim]) n++;
  return n;
}
