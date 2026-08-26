/**
 * Contraste mensual **hoja de cálculo ↔ Convex** — cierra **A56**.
 *
 * ## El problema que resuelve
 *
 * La migración financiera fue **una foto**: se leyó la hoja el 25-jul y se
 * copiaron 505 filas. Pero la hoja **sigue viva**, y ya nos mordió una vez —
 * julio-2026 cambió en 6 líneas *después* de migrarlo y se descubrió de casualidad
 * (**A56**), con ₡98.599 de diferencia. Mientras la hoja siga en uso, cualquier
 * mes puede moverse hacia atrás y el panel seguiría mostrando la foto vieja sin
 * decir nada.
 *
 * Esto corre una vez al mes, compara los 13 meses migrados y avisa.
 *
 * ## La decisión que cambió el diseño a mitad de camino
 *
 * Lo natural era comparar contra **la celda TOTAL** de cada mes: es el número
 * que Esteban mira. La primera corrida contra datos reales mostró que eso
 * habría estado mal, porque **la hoja se equivoca en su propia suma**:
 *
 *  - **julio-2025**: el TOTAL de ingresos deja **la última semana fuera**
 *    (₡941.000 = «SEMANA DEL 28 AL 3» + «COLES DEL 28 AL 3»).
 *  - **diciembre-2025**: el TOTAL de gastos **suma dos veces el subtotal
 *    `TOTAL FIJOS`** ($1.340 de más, dos veces = $2.680), y por eso ese mes se
 *    ve como una pérdida de $2.685 cuando en realidad quedó casi en cero.
 *
 * En los dos casos **Convex tiene razón y la hoja no**. Si el contraste hubiera
 * comparado contra la celda TOTAL, habría reportado a Convex como el
 * equivocado — o sea, exactamente al revés.
 *
 * Así que se comparan **dos cosas distintas** y se reportan aparte:
 *
 *  1. **Convex contra las FILAS de la hoja** — ¿seguimos teniendo lo mismo?
 *     Es la alarma de A56.
 *  2. **Las filas de la hoja contra su propia celda TOTAL** — ¿la hoja cuadra
 *     consigo misma? Es un regalo del primer punto, y hoy encuentra dos errores.
 *
 * ## Por qué se compara en moneda ORIGINAL
 *
 * De sep-2025 a feb-2026 la hoja está escrita en dólares y Convex guarda
 * colones (RD-05, con el tipo de cambio del día congelado por fila). Comparar
 * los colones de Convex contra los dólares de la hoja exigiría rehacer la
 * conversión y cualquier diferencia de redondeo se leería como un cambio en la
 * hoja. Comparando `originalAmount` contra el texto de la hoja, **el tipo de
 * cambio no entra en la cuenta**.
 */
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * La hoja de Esteban. Se puede sobreescribir por env, pero trae valor por
 * defecto **a propósito**: una función que no hace nada hasta que alguien
 * recuerde poner una variable es la forma más común de entregar algo que nunca
 * corre — este proyecto ya tuvo cuatro consultas desplegadas sin consumidor.
 * No es una credencial: la hoja se lee por enlace, sin sesión.
 */
const SHEET_POR_DEFECTO = "1yW-IShfvRQDO-TbeIKd_znW17lEIreH68JpHtBZsruc";

/**
 * Pestañas que NO son meses. Son las mismas que omitió la migración (F1-WP1):
 * plantillas, bases auxiliares y una proyección.
 */
const PESTANAS_IGNORADAS = new Set([
  "dolares bd",
  "colones bd",
  "ideal",
  "copia de ideal",
  "hoja 3",
  "2026 proyeccion jake",
]);

/** Nombre de pestaña → `AAAA-MM`. Las de 2025 no llevan año en el nombre. */
const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * «JULIO» → `2025-07`; «MARZO 2026» → `2026-03`.
 *
 * El año por defecto es **2025** porque así están nombradas las pestañas del
 * primer semestre; a partir de enero el nombre lo trae. Si aparece una pestaña
 * nueva sin año —«AGOSTO» de 2026, por ejemplo— caería en 2025 y chocaría con
 * la existente: por eso se devuelve `null` ante un mes repetido y el contraste
 * lo reporta en vez de sobreescribir.
 */
export function pestanaAMes(nombre: string): string | null {
  const t = normalizar(nombre);
  if (PESTANAS_IGNORADAS.has(t)) return null;
  const partes = t.split(" ");
  const mes = MESES[partes[0]];
  if (!mes) return null;
  const anio = partes.find((p) => /^20\d\d$/.test(p)) ?? "2025";
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

/**
 * Número en locale CR: `.` miles, `,` decimales. Paréntesis = negativo.
 *
 * **`$ -` vale CERO, no «vacío»**, y esa distinción costó un error real. En la
 * hoja el guion es cómo se escribe un cero; si se devuelve `null`, el lector de
 * la fila sigue buscando y **se lleva el número de la columna siguiente**. En
 * mayo-2026 la fila «BONOS EXTRAS» tiene `$ -` en la columna del monto y un
 * **3** en la de «CANTIDAD VIAJES EXTRA»: sin esto, el contraste sumaba ₡3 de
 * un conteo de viajes y reportaba una diferencia que no existía.
 */
export function numeroCR(raw: string | undefined): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/^[$₡\s]*[-–—]\s*$/.test(t)) return 0;
  const negativo = /\(/.test(t) || /-\s*[\d$]/.test(t);
  const limpio = t.replace(/[^0-9.,]/g, "");
  if (!limpio) return null;
  const n = Number(limpio.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** CSV mínimo con comillas dobles escapadas. gviz no produce nada más raro. */
export function parsearCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { celda += '"'; i++; } else enComillas = false;
      } else celda += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(celda); celda = ""; }
    else if (c === "\n") { fila.push(celda); filas.push(fila); fila = []; celda = ""; }
    else if (c !== "\r") celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

/**
 * `GASOLINA TECNICO`: a veces es un gasto y a veces es el subtotal de los
 * viáticos de las semanas. **La etiqueta no lo distingue; la aritmética sí.**
 *
 * Comprobado en las tres pestañas donde aparece:
 *
 * | Mes | La fila dice | Viáticos semanales | ¿Qué es? |
 * |---|---|---|---|
 * | mar-2026 | ₡188.000 | **no hay** | un gasto de verdad |
 * | may-2026 | ₡130.000 | 36+34+30+30 = ₡130.000 | subtotal |
 * | jun-2026 | ₡110.000 | 34+30+26+20 = ₡110.000 | subtotal |
 *
 * Por eso la regla es **estructural y no una lista de nombres**: se descuenta
 * solo cuando *coincide con lo que sería su subtotal*. Una lista habría dado
 * marzo por subtotal y borrado ₡188.000 de gasto real — que es justo lo que
 * pasó en el primer intento.
 *
 * Y se autolimita: si el mes que viene los números dejan de coincidir, la fila
 * cuenta como gasto y el contraste marca el mes. Que alguien mire es
 * exactamente lo que corresponde.
 */
const ETIQUETA_SUBTOTAL_VIATICOS = "gasolina tecnico";
const ETIQUETA_VIATICOS = "viaticos tecnico";

function esSubtotal(etiqueta: string): boolean {
  return etiqueta.startsWith("total") || etiqueta.startsWith("subtotal");
}

export type MesParseado = {
  yearMonth: string;
  hojaIngreso: number;
  hojaGasto: number;
  hojaFilas: number;
  totalIngreso: number | null;
  totalGasto: number | null;
};

/**
 * Lee una pestaña y devuelve sus dos sumas y sus dos totales.
 *
 * La máquina de estados es la misma de la migración (F1-WP1): **por etiqueta,
 * no por celda fija**, porque los meses de 2025 traen 3 columnas y los de 2026
 * hasta 8. Lo único que importa es dónde empieza el bloque de gastos
 * (`GASTOS SIN IVA`) y dónde cierra cada bloque (una etiqueta `TOTAL` sola).
 *
 * **Los subtotales se excluyen de la suma de filas.** `TOTAL SEMANA`,
 * `TOTAL FIJOS`, `TOTAL ADS` y compañía son sumas de otras filas: contarlas
 * duplicaría la plata. Justamente contarlas es el error que tiene la hoja en
 * diciembre.
 */
export function parsearPestana(
  yearMonth: string,
  filas: string[][],
): MesParseado {
  let enGastos = false;
  let hojaIngreso = 0;
  let hojaGasto = 0;
  let hojaFilas = 0;
  let totalIngreso: number | null = null;
  let totalGasto: number | null = null;
  const viaticos: number[] = [];
  let gasolina: number | null = null;

  for (const fila of filas) {
    const etiqueta = normalizar(fila[0] ?? "");
    if (!etiqueta) continue;

    if (etiqueta === "gastos sin iva") { enGastos = true; continue; }

    // La celda TOTAL cierra su bloque. Es la suma que la hoja MUESTRA, y se
    // guarda aparte para poder contrastarla contra sus propias filas.
    if (etiqueta === "total") {
      const v0 = primerNumero(fila);
      if (v0 === null) continue;
      if (!enGastos) totalIngreso ??= v0;
      else totalGasto ??= v0;
      continue;
    }

    // Subtotales: suman filas de arriba, así que contarlos duplica la plata.
    if (esSubtotal(etiqueta)) continue;
    if (etiqueta.startsWith("margen") || etiqueta === "utilidad") continue;

    const valor = primerNumero(fila);
    if (valor === null || valor === 0) continue;

    hojaFilas++;
    if (enGastos) {
      hojaGasto += valor;
      if (etiqueta === ETIQUETA_VIATICOS) viaticos.push(valor);
      if (etiqueta === ETIQUETA_SUBTOTAL_VIATICOS) gasolina = valor;
    } else hojaIngreso += valor;
  }

  // Si la fila de gasolina coincide con la suma de los viáticos semanales, es
  // su subtotal y ya está contada. Ver la nota de `ETIQUETA_SUBTOTAL_VIATICOS`.
  const sumaViaticos = viaticos.reduce((s, v) => s + v, 0);
  if (
    gasolina !== null &&
    viaticos.length > 0 &&
    Math.abs(gasolina - sumaViaticos) < 0.01
  ) {
    hojaGasto -= gasolina;
    hojaFilas--;
  }

  return {
    yearMonth,
    hojaIngreso: redondear(hojaIngreso),
    hojaGasto: redondear(hojaGasto),
    hojaFilas,
    totalIngreso: totalIngreso === null ? null : redondear(totalIngreso),
    totalGasto: totalGasto === null ? null : redondear(totalGasto),
  };
}

/**
 * El monto de una fila: la primera celda con número, de izquierda a derecha.
 *
 * **Hubo aquí un corte por columna que se quitó**, y vale contar por qué: se
 * había puesto para no confundir con plata las anotaciones que el layout de
 * 2026 pone a la derecha (porcentajes, bases de cálculo, cantidad de viajes).
 * Al revisar las 13 pestañas, **ninguna** de esas anotaciones aparece sin que
 * haya un número antes en B o C, así que el corte no evitaba nada. Lo único que
 * hacía era descartar una fila —`GASOLINA TECNICO`— **por estar lejos**, cuando
 * lo correcto es descartarla por ser un subtotal (ver `SUBTOTALES`). Un guard
 * que acierta por el motivo equivocado se rompe el día que alguien mueva una
 * celda de columna, y sin avisar.
 */
function primerNumero(fila: string[]): number | null {
  for (let i = 1; i < fila.length; i++) {
    const n = numeroCR(fila[i]);
    if (n !== null) return n;
  }
  return null;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/* -------------------------------------------------------------------------- */

type Resultado = {
  meses: number;
  significativos: number;
  pestanasIgnoradas: number;
  sinReconocer: string[];
  ms: number;
};

export const contrastarHoja = internalAction({
  args: {},
  returns: v.object({
    meses: v.number(),
    significativos: v.number(),
    pestanasIgnoradas: v.number(),
    sinReconocer: v.array(v.string()),
    ms: v.number(),
  }),
  handler: async (ctx): Promise<Resultado> => {
    const t0 = Date.now();
    const sheet = process.env.FINANCE_SHEET_ID ?? SHEET_POR_DEFECTO;

    /* 1 · Descubrir las pestañas, no darlas por escritas.
       Una lista fija en el código deja de ver el mes que Esteban agregue, y
       ese mes es justamente el que nadie estaría vigilando. */
    const hv = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheet}/htmlview`,
    );
    if (!hv.ok) {
      await ctx.runMutation(internal.bi.contraste.escribirMeta, {
        status: "error",
        message: `No se pudo abrir la hoja (HTTP ${hv.status}). ¿Cambió el enlace o dejó de ser pública?`,
        rowsProcessed: 0,
      });
      throw new Error(`htmlview ${hv.status}`);
    }
    const html = await hv.text();
    const pares = [...html.matchAll(/items\.push\(\{name: "([^"]+)".*?gid: "(\d+)"/g)];
    if (pares.length === 0) {
      await ctx.runMutation(internal.bi.contraste.escribirMeta, {
        status: "error",
        message:
          "La hoja abrió pero no se reconoció ninguna pestaña — probablemente cambió el formato del htmlview.",
        rowsProcessed: 0,
      });
      throw new Error("sin pestañas");
    }

    /* 2 · Leer cada mes */
    const parseados: MesParseado[] = [];
    const sinReconocer: string[] = [];
    const vistos = new Set<string>();
    let ignoradas = 0;

    for (const [, nombre, gid] of pares) {
      const ym = pestanaAMes(nombre);
      if (ym === null) { ignoradas++; continue; }
      if (vistos.has(ym)) {
        // Dos pestañas para el mismo mes: no se elige una en silencio.
        sinReconocer.push(`${nombre} → ${ym} (repetido)`);
        continue;
      }
      vistos.add(ym);

      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${sheet}/gviz/tq?tqx=out:csv&gid=${gid}`,
      );
      if (!res.ok) { sinReconocer.push(`${nombre} (HTTP ${res.status})`); continue; }
      parseados.push(parsearPestana(ym, parsearCSV(await res.text())));
    }

    /* 3 · Comparar y guardar */
    const { significativos } = await ctx.runMutation(
      internal.bi.contraste.guardarContraste,
      { meses: parseados, runAt: t0 },
    );

    await ctx.runMutation(internal.bi.contraste.escribirMeta, {
      status: "ok",
      rowsProcessed: parseados.length,
      message:
        significativos === 0
          ? `${parseados.length} meses contrastados, todos cuadran`
          : `${parseados.length} meses contrastados, ${significativos} con diferencia`,
    });

    return {
      meses: parseados.length,
      significativos,
      pestanasIgnoradas: ignoradas,
      sinReconocer,
      ms: Date.now() - t0,
    };
  },
});

/* ========================================================================== */
/* Comparación y guardado                                                     */
/* ========================================================================== */

/**
 * Diferencia mínima para molestar, en la moneda del mes.
 *
 * Un colón —o un dólar— no es una edición de nadie: es redondeo. Julio-2026
 * arrastra **₡0,13** desde su re-importación (A56) y no significa nada. Por
 * encima de una unidad ya no hay explicación inocente.
 */
export const TOLERANCIA = 1;

/**
 * Diferencias que **ya sabemos por qué existen**, con su monto exacto.
 *
 * Pinnearlas al monto y no al mes es lo que las distingue de silenciar la
 * alarma: si la hoja vuelve a moverse en marzo, la diferencia deja de ser
 * −20.004 y el aviso regresa solo. Silenciar el mes entero, en cambio, lo
 * dejaría ciego para siempre.
 */
export const DIFERENCIAS_ESPERADAS: Array<{
  yearMonth: string;
  campo: "ingreso" | "gasto";
  monto: number;
  motivo: string;
}> = [
  {
    yearMonth: "2026-03",
    campo: "gasto",
    monto: -20004,
    motivo:
      "Corrección autorizada por Esteban el 24-ago (B37/A97): marzo llevaba las cargas sociales completas y solo correspondía el aporte patronal. La hoja conserva el valor viejo.",
  },
];

function esperada(
  yearMonth: string,
  campo: "ingreso" | "gasto",
  dif: number,
): string | null {
  const e = DIFERENCIAS_ESPERADAS.find(
    (x) => x.yearMonth === yearMonth && x.campo === campo,
  );
  if (!e) return null;
  return Math.abs(dif - e.monto) <= TOLERANCIA ? e.motivo : null;
}

export const escribirMeta = internalMutation({
  args: {
    status: v.union(v.literal("ok"), v.literal("error")),
    rowsProcessed: v.number(),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { status, rowsProcessed, message }) => {
    const fila = await ctx.db
      .query("bi_meta")
      .withIndex("by_key", (q) => q.eq("key", "sheet_contrast"))
      .unique();
    const doc = {
      key: "sheet_contrast",
      lastRunAt: Date.now(),
      lastStatus: status,
      rowsProcessed,
      message,
    };
    if (fila) await ctx.db.patch(fila._id, doc);
    else await ctx.db.insert("bi_meta", doc);
    return null;
  },
});

export const guardarContraste = internalMutation({
  args: {
    meses: v.array(
      v.object({
        yearMonth: v.string(),
        hojaIngreso: v.number(),
        hojaGasto: v.number(),
        hojaFilas: v.number(),
        totalIngreso: v.union(v.number(), v.null()),
        totalGasto: v.union(v.number(), v.null()),
      }),
    ),
    runAt: v.number(),
  },
  returns: v.object({ guardados: v.number(), significativos: v.number() }),
  handler: async (ctx, { meses, runAt }) => {
    const finanzas = await ctx.db.query("finance_entries").collect();
    let significativos = 0;

    for (const m of meses) {
      const propias = finanzas.filter(
        (r) =>
          r.yearMonth === m.yearMonth && !r.isDeleted && r.source === "sheet",
      );
      const suma = (kind: "income" | "expense") =>
        propias
          .filter((r) => r.kind === kind)
          .reduce((s, r) => s + (r.originalAmount ?? r.amountCRC), 0);

      const convexIngreso = Math.round(suma("income") * 100) / 100;
      const convexGasto = Math.round(suma("expense") * 100) / 100;

      const monedas = new Set(propias.map((r) => r.originalCurrency));
      const moneda =
        monedas.size === 0 ? "—" : monedas.size > 1 ? "mixta" : [...monedas][0];

      const difIngreso = Math.round((convexIngreso - m.hojaIngreso) * 100) / 100;
      const difGasto = Math.round((convexGasto - m.hojaGasto) * 100) / 100;

      const motivoIng = esperada(m.yearMonth, "ingreso", difIngreso);
      const motivoGas = esperada(m.yearMonth, "gasto", difGasto);

      const alarmaIng = Math.abs(difIngreso) > TOLERANCIA && !motivoIng;
      const alarmaGas = Math.abs(difGasto) > TOLERANCIA && !motivoGas;
      const significativo = alarmaIng || alarmaGas;
      if (significativo) significativos++;

      const doc = {
        yearMonth: m.yearMonth,
        moneda,
        hojaIngreso: m.hojaIngreso,
        hojaGasto: m.hojaGasto,
        hojaFilas: m.hojaFilas,
        totalIngreso: m.totalIngreso,
        totalGasto: m.totalGasto,
        convexIngreso,
        convexGasto,
        convexFilas: propias.length,
        difIngreso,
        difGasto,
        difTotalIngreso:
          m.totalIngreso === null
            ? null
            : Math.round((m.hojaIngreso - m.totalIngreso) * 100) / 100,
        difTotalGasto:
          m.totalGasto === null
            ? null
            : Math.round((m.hojaGasto - m.totalGasto) * 100) / 100,
        significativo,
        explicacion: motivoIng ?? motivoGas ?? null,
        runAt,
      };

      const previa = await ctx.db
        .query("bi_sheet_contrast")
        .withIndex("by_year_month", (q) => q.eq("yearMonth", m.yearMonth))
        .unique();
      if (previa) await ctx.db.patch(previa._id, doc);
      else await ctx.db.insert("bi_sheet_contrast", doc);
    }

    return { guardados: meses.length, significativos };
  },
});

/* ========================================================================== */
/* Lectura                                                                    */
/* ========================================================================== */

const filaContraste = v.object({
  yearMonth: v.string(),
  moneda: v.string(),
  hojaIngreso: v.number(),
  hojaGasto: v.number(),
  hojaFilas: v.number(),
  totalIngreso: v.union(v.number(), v.null()),
  totalGasto: v.union(v.number(), v.null()),
  convexIngreso: v.number(),
  convexGasto: v.number(),
  convexFilas: v.number(),
  difIngreso: v.number(),
  difGasto: v.number(),
  difTotalIngreso: v.union(v.number(), v.null()),
  difTotalGasto: v.union(v.number(), v.null()),
  significativo: v.boolean(),
  explicacion: v.union(v.string(), v.null()),
});

export const contrasteReturns = v.object({
  corridaAt: v.union(v.number(), v.null()),
  estado: v.union(v.string(), v.null()),
  mensaje: v.union(v.string(), v.null()),
  meses: v.array(filaContraste),
  conDiferencia: v.number(),
  conExplicacion: v.number(),
  /** Meses donde la hoja NO cuadra consigo misma. Es un problema de la hoja. */
  hojaNoCuadra: v.array(
    v.object({
      yearMonth: v.string(),
      moneda: v.string(),
      campo: v.string(),
      filas: v.number(),
      total: v.number(),
      diferencia: v.number(),
    }),
  ),
  tolerancia: v.number(),
  nota: v.string(),
});

export const contraste = internalQuery({
  args: {},
  returns: contrasteReturns,
  handler: async (ctx) => contrasteImpl(ctx),
});

/** Cómputo plano compartido con el wrapper público (A41). */
export async function contrasteImpl(ctx: QueryCtx) {
  const filas = await ctx.db.query("bi_sheet_contrast").collect();
  filas.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

  const meta = await ctx.db
    .query("bi_meta")
    .withIndex("by_key", (q) => q.eq("key", "sheet_contrast"))
    .unique();

  const hojaNoCuadra: Array<{
    yearMonth: string;
    moneda: string;
    campo: string;
    filas: number;
    total: number;
    diferencia: number;
  }> = [];
  for (const f of filas) {
    for (const [campo, dif, filasV, totalV] of [
      ["ingresos", f.difTotalIngreso, f.hojaIngreso, f.totalIngreso],
      ["gastos", f.difTotalGasto, f.hojaGasto, f.totalGasto],
    ] as const) {
      if (dif === null || totalV === null) continue;
      if (Math.abs(dif) <= TOLERANCIA) continue;
      hojaNoCuadra.push({
        yearMonth: f.yearMonth,
        moneda: f.moneda,
        campo,
        filas: filasV,
        total: totalV,
        diferencia: dif,
      });
    }
  }

  return {
    corridaAt: meta?.lastRunAt ?? null,
    estado: meta?.lastStatus ?? null,
    mensaje: meta?.message ?? null,
    meses: filas.map((f) => ({
      yearMonth: f.yearMonth,
      moneda: f.moneda,
      hojaIngreso: f.hojaIngreso,
      hojaGasto: f.hojaGasto,
      hojaFilas: f.hojaFilas,
      totalIngreso: f.totalIngreso,
      totalGasto: f.totalGasto,
      convexIngreso: f.convexIngreso,
      convexGasto: f.convexGasto,
      convexFilas: f.convexFilas,
      difIngreso: f.difIngreso,
      difGasto: f.difGasto,
      difTotalIngreso: f.difTotalIngreso,
      difTotalGasto: f.difTotalGasto,
      significativo: f.significativo,
      explicacion: f.explicacion,
    })),
    conDiferencia: filas.filter((f) => f.significativo).length,
    conExplicacion: filas.filter((f) => f.explicacion !== null).length,
    hojaNoCuadra,
    tolerancia: TOLERANCIA,
    nota: "Se compara en MONEDA ORIGINAL (la hoja está en $ de sep-2025 a feb-2026) para que el tipo de cambio no entre en la cuenta. «Convex» son solo las filas con source:sheet — lo capturado por la app o a mano no viene de la hoja y no debería cuadrar con ella. La comparación titular es contra las FILAS de la hoja, no contra su celda TOTAL: esa celda se equivoca en dos meses.",
  };
}
