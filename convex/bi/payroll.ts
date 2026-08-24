/**
 * Planilla del mes — la superficie de Convex (B28).
 *
 * El **cálculo** vive en `@/lib/payroll`, fuera de esta carpeta, porque lo
 * necesitan las dos puntas: el servidor para guardar y la pantalla para mostrar
 * el resultado mientras Esteban escribe. Acá quedan la mutation y la query.
 */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { crMidnightMs } from "./lib/dates";
import {
  TASAS_POR_DEFECTO,
  calcularPlanilla,
  llaveDeLinea,
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

    const tasas = args.tasas ?? TASAS_POR_DEFECTO;
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
  }),
  handler: async (ctx, { yearMonth: ym }) => {
    await requireAdmin(ctx);
    const fila = await ctx.db
      .query("payroll_months")
      .withIndex("by_year_month", (q) => q.eq("yearMonth", ym))
      .unique();

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
      tasasPorDefecto: TASAS_POR_DEFECTO,
      lineas,
      totalCRC: lineas.reduce((a, l) => a + l.amountCRC, 0),
    };
  },
});
