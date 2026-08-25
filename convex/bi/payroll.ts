/**
 * Planilla del mes — la superficie de Convex (B28).
 *
 * El **cálculo** vive en `@/lib/payroll`, fuera de esta carpeta, porque lo
 * necesitan las dos puntas: el servidor para guardar y la pantalla para mostrar
 * el resultado mientras Esteban escribe. Acá quedan la mutation y la query.
 */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { crMidnightMs } from "./lib/dates";
import { etiquetaDeExternalKey, normalizar } from "./expenseGroups";
import {
  calcularPlanilla,
  llaveDeLinea,
  tasasDelMes,
  vigenciaDelMes,
} from "@/lib/payroll";

export const tasasValidator = v.object({
  aportePatronalPct: v.number(),
  provisionPct: v.number(),
  vacacionesPct: v.number(),
  impuestosPct: v.number(),
});


/* -------------------------------------------------------------------------- */
/* Registro del mes                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Último día del mes, que es la fecha con la que quedaron registradas las
 * planillas que vinieron de la hoja (31-jul, 30-jun…).
 *
 * Se respeta esa convención en vez de inventar una nueva: si las filas viejas y
 * las nuevas cayeran en días distintos, cualquier corte por fecha las separaría
 * sin motivo.
 */
export function ultimoDiaDelMes(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  // Día 0 del mes siguiente = último del actual, y JS resuelve los bisiestos.
  const dia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(dia).padStart(2, "0")}`;
}

const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/* -------------------------------------------------------------------------- */
/* Guard: el mes ya trae estas líneas por otra vía (B34)                       */
/* -------------------------------------------------------------------------- */

/**
 * ¿Esta etiqueta de la hoja es una de las seis líneas que derivamos acá?
 *
 * Se compara por **patrón** y no contra una lista cerrada porque la hoja no usa
 * un vocabulario fijo: además de las cinco que conocíamos apareció
 * `PROVISION DESPIDO`, que no generamos pero **es** una provisión y duplicaría
 * igual. Un prefijo cubre las que vengan.
 *
 * Lo que NO debe calzar, y es la mitad importante de la regla: los salarios
 * brutos (`SALARIO BRUTO TECNICO`, `SALARIO JEFE OPERACIONES`). Esos son el
 * **insumo**, no el resultado — están cargados en agosto, que es justo el mes
 * con el que Esteban tiene que estrenar la pantalla. Si el guard los tomara por
 * conflicto, bloquearía el único mes que sí se puede registrar.
 */
export function esLineaDerivadaDePlanilla(etiqueta: string): boolean {
  const t = normalizar(etiqueta).trim();
  if (!t) return false;
  return (
    t.startsWith("provision") ||
    t.includes("aporte patron") || // «APORTE PATRONO CCSS»
    t === "impuestos"
  );
}

/**
 * ¿Este movimiento es la póliza del INS?
 *
 * Se compara la palabra suelta «ins», no un `includes`: «seguro carro» —el otro
 * habitante de la categoría `seguro`— no la contiene, y un `includes("ins")`
 * calzaría con cualquier cosa que traiga esas tres letras adentro.
 */
export function esPolizaINS(etiqueta: string): boolean {
  return /(^|[^a-z])ins([^a-z]|$)/.test(normalizar(etiqueta));
}

/**
 * La póliza del INS anotada aparte en un mes cuya tasa **ya la incluye**.
 *
 * Desde agosto el aporte patronal es 28,28%, que trae adentro el 2,45% del INS.
 * Si además existe la línea suelta de la póliza, el INS se cuenta dos veces.
 *
 * Devuelve el dato para **avisar, no para bloquear**: la póliza es información
 * suya y podría cubrir otra cosa. Lo que no puede es pasar inadvertida.
 */
export async function polizaINSDuplicada(
  ctx: QueryCtx,
  yearMonth: string,
): Promise<{ etiqueta: string; amountCRC: number } | null> {
  if (!vigenciaDelMes(yearMonth).incluyeINS) return null;

  const filas = await ctx.db
    .query("finance_entries")
    .withIndex("by_year_month", (q) => q.eq("yearMonth", yearMonth))
    .collect();

  for (const f of filas) {
    if (f.isDeleted || f.kind !== "expense" || f.category !== "seguro") continue;
    const etiqueta = etiquetaDeExternalKey(f.externalKey) ?? (f.note ?? "").trim();
    if (esPolizaINS(etiqueta)) return { etiqueta, amountCRC: f.amountCRC };
  }
  return null;
}

const lineaPreexistenteValidator = v.object({
  etiqueta: v.string(),
  amountCRC: v.number(),
  source: v.string(),
});

/**
 * Las líneas de planilla que ese mes **ya tiene cargadas por otra vía**.
 *
 * El problema que resuelve (**B34**): marzo a julio de 2026 ya traen las seis
 * líneas desde la hoja de Esteban, con llave `sheet:<MES> 2026:<etiqueta>:<n>`.
 * Esta pantalla escribe con llave `planilla:<mes>:<línea>`, que es **otra**
 * llave, así que registrar uno de esos meses no corregiría nada: **duplicaría**
 * el gasto de planilla del mes.
 *
 * La idempotencia por llave natural protege contra confirmar **dos veces el
 * mismo mes**; no contra un mes **que ya vino por otro camino**. Son dos cosas
 * distintas y solo la primera estaba cubierta.
 *
 * Por eso se excluye `source: "planilla"`: esas son las nuestras y volver a
 * confirmarlas es el flujo normal de corrección, no un conflicto.
 */
export async function lineasDePlanillaYaCargadas(
  ctx: QueryCtx,
  yearMonth: string,
): Promise<Array<{ etiqueta: string; amountCRC: number; source: string }>> {
  const filas = await ctx.db
    .query("finance_entries")
    .withIndex("by_year_month", (q) => q.eq("yearMonth", yearMonth))
    .collect();

  const encontradas: Array<{ etiqueta: string; amountCRC: number; source: string }> = [];
  for (const f of filas) {
    if (f.isDeleted) continue;
    if (f.kind !== "expense") continue;
    if (f.source === "planilla") continue;

    // La etiqueta de la hoja primero; la nota como respaldo, que es lo que
    // tienen las filas capturadas a mano.
    const etiqueta = etiquetaDeExternalKey(f.externalKey) ?? (f.note ?? "").trim();
    if (!esLineaDerivadaDePlanilla(etiqueta)) continue;

    encontradas.push({ etiqueta, amountCRC: f.amountCRC, source: f.source });
  }

  return encontradas.sort((a, b) => b.amountCRC - a.amountCRC);
}

const lineaCalculadaValidator = v.object({
  linea: v.string(),
  label: v.string(),
  category: v.string(),
  amountCRC: v.number(),
  formula: v.string(),
});

const resultadoValidator = v.object({
  yearMonth: v.string(),
  lineas: v.array(lineaCalculadaValidator),
  totalCRC: v.number(),
  /** Cuántas de las seis se crearon y cuántas se actualizaron. */
  creadas: v.number(),
  actualizadas: v.number(),
});

/**
 * Registra (o corrige) la planilla de un mes.
 *
 * **Idempotente por mes**: volver a confirmar el mismo mes **actualiza** las seis
 * líneas en vez de duplicarlas, igual que F5-auto. Es lo que hace seguro
 * corregir un salario mal escrito: se cambia el dato de arriba y las seis se
 * recalculan solas, sin que quede una provisión con un número viejo.
 */
export const registrarPlanilla = mutation({
  args: {
    yearMonth: v.string(),
    salarioCRC: v.number(),
    comisionesCRC: v.number(),
    baseImponibleCRC: v.number(),
    /** Si no vienen, se usan las que reproducen la hoja de Esteban. */
    tasas: v.optional(tasasValidator),
  },
  returns: resultadoValidator,
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    if (!FORMATO_MES.test(args.yearMonth)) {
      throw new Error(`Mes inválido: "${args.yearMonth}". Se espera AAAA-MM.`);
    }
    for (const [campo, valor] of [
      ["salario", args.salarioCRC],
      ["comisiones", args.comisionesCRC],
      ["base a reportar", args.baseImponibleCRC],
    ] as const) {
      if (!Number.isFinite(valor) || valor < 0) {
        throw new Error(`El ${campo} no puede ser negativo.`);
      }
    }

    // El mes no puede traer ya estas líneas por otra vía (B34). Va **antes** de
    // escribir nada: la mutation es transaccional, así que el throw revierte,
    // pero dejarlo primero es lo que hace obvio al leer que no queda a medias.
    const yaCargadas = await lineasDePlanillaYaCargadas(ctx, args.yearMonth);
    if (yaCargadas.length > 0) {
      const detalle = yaCargadas.map((l) => l.etiqueta).join(", ");
      throw new Error(
        `El mes ${args.yearMonth} ya tiene ${yaCargadas.length} línea(s) de planilla ` +
          `cargadas por otra vía (${detalle}). Registrarlo acá las duplicaría en vez ` +
          `de corregirlas. Si querés reemplazarlas, hay que dar de baja primero las ` +
          `que ya están.`,
      );
    }

    const tasas = args.tasas ?? tasasDelMes(args.yearMonth);
    const now = Date.now();
    const date = crMidnightMs(ultimoDiaDelMes(args.yearMonth));

    // 1) Los insumos del mes, para poder mostrarlos y recalcular después.
    const previo = await ctx.db
      .query("payroll_months")
      .withIndex("by_year_month", (q) => q.eq("yearMonth", args.yearMonth))
      .unique();
    const insumos = {
      yearMonth: args.yearMonth,
      salarioCRC: args.salarioCRC,
      comisionesCRC: args.comisionesCRC,
      baseImponibleCRC: args.baseImponibleCRC,
      tasas,
      updatedAt: now,
    };
    if (previo) {
      await ctx.db.patch(previo._id, insumos);
    } else {
      await ctx.db.insert("payroll_months", {
        ...insumos,
        createdBy: admin.clerkId,
        createdAt: now,
      });
    }

    // 2) Las seis líneas derivadas, por llave natural.
    const lineas = calcularPlanilla(args, tasas);
    let creadas = 0;
    let actualizadas = 0;

    for (const l of lineas) {
      const externalKey = llaveDeLinea(args.yearMonth, l.linea);
      const existente = await ctx.db
        .query("finance_entries")
        .withIndex("by_external_key", (q) => q.eq("externalKey", externalKey))
        .unique();

      const fila = {
        kind: "expense" as const,
        category: l.category,
        isViatico: false,
        amountCRC: l.amountCRC,
        originalCurrency: "CRC" as const,
        date,
        yearMonth: args.yearMonth,
        source: "planilla" as const,
        externalKey,
        note: `${l.label} — ${l.formula}`,
        isDeleted: false,
        updatedAt: now,
      };

      if (existente) {
        await ctx.db.patch(existente._id, fila);
        actualizadas++;
      } else {
        await ctx.db.insert("finance_entries", {
          ...fila,
          createdBy: admin.clerkId,
          createdAt: now,
        });
        creadas++;
      }
    }

    return {
      yearMonth: args.yearMonth,
      lineas,
      totalCRC: lineas.reduce((a, l) => a + l.amountCRC, 0),
      creadas,
      actualizadas,
    };
  },
});

/**
 * Lo que hay guardado de un mes, más el cálculo.
 *
 * Devuelve `null` en `insumos` si ese mes todavía no se registró — así la
 * pantalla puede arrancar en blanco sin tener que adivinar.
 */
export const planillaDelMes = query({
  args: { yearMonth: v.string() },
  returns: v.object({
    yearMonth: v.string(),
    insumos: v.union(
      v.object({
        salarioCRC: v.number(),
        comisionesCRC: v.number(),
        baseImponibleCRC: v.number(),
        tasas: tasasValidator,
        updatedAt: v.number(),
      }),
      v.null(),
    ),
    tasasPorDefecto: tasasValidator,
    lineas: v.array(lineaCalculadaValidator),
    totalCRC: v.number(),
    /**
     * Líneas de planilla que el mes ya trae por otra vía (B34). Si vienen, el
     * mes **no se puede registrar** y la pantalla lo avisa antes de que Esteban
     * escriba nada — un guard que solo salta después de llenar el formulario y
     * pulsar el botón es un guard peor.
     */
    lineasYaCargadas: v.array(lineaPreexistenteValidator),
    /** La vigencia que rige este mes, para poder mostrar de dónde sale la tasa. */
    vigencia: v.object({
      desde: v.string(),
      incluyeINS: v.boolean(),
      nota: v.string(),
    }),
    /** Póliza del INS anotada aparte en un mes cuya tasa ya la incluye. */
    avisoPolizaINS: v.union(
      v.object({ etiqueta: v.string(), amountCRC: v.number() }),
      v.null(),
    ),
  }),
  handler: async (ctx, { yearMonth: ym }) => {
    await requireAdmin(ctx);
    const fila = await ctx.db
      .query("payroll_months")
      .withIndex("by_year_month", (q) => q.eq("yearMonth", ym))
      .unique();

    const vig = vigenciaDelMes(ym);
    const insumos = fila
      ? {
          salarioCRC: fila.salarioCRC,
          comisionesCRC: fila.comisionesCRC,
          baseImponibleCRC: fila.baseImponibleCRC,
          tasas: fila.tasas,
          updatedAt: fila.updatedAt,
        }
      : null;

    const lineas = insumos
      ? calcularPlanilla(insumos, insumos.tasas)
      : [];

    return {
      yearMonth: ym,
      insumos,
      tasasPorDefecto: vig.tasas,
      lineas,
      totalCRC: lineas.reduce((a, l) => a + l.amountCRC, 0),
      lineasYaCargadas: await lineasDePlanillaYaCargadas(ctx, ym),
      vigencia: {
        desde: vig.desde,
        incluyeINS: vig.incluyeINS,
        nota: vig.nota,
      },
      avisoPolizaINS: await polizaINSDuplicada(ctx, ym),
    };
  },
});
