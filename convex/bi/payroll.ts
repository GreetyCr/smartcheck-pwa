/**
 * Planilla del mes — los gastos que se calculan solos (B28 · B29 · B30).
 *
 * Esteban escribe **tres** datos una vez al mes y el sistema deriva **seis**
 * líneas. Hoy hace esas seis cuentas a mano en su hoja, y ya nos costó una vez:
 * cuando importamos julio, las comisiones estaban en cero, después las llenó y
 * las tres provisiones se recalcularon solas — pero el sistema se había quedado
 * con la foto vieja. Eran ₡98.599 de los que faltaban.
 *
 * ---
 *
 * ## Sobre el porcentaje del aporte patronal
 *
 * Acá hay una decisión que **no tomamos nosotros**, y conviene entender por qué.
 *
 * Su hoja viene aplicando **26,92%** sobre el salario, y eso reproduce sus
 * números al colón: 430.000 × 26,92% = ₡115.756, que es exactamente lo que
 * registró en abril, mayo, junio y julio.
 *
 * Después nos mandó la tabla oficial de cargas patronales 2026, que suma
 * **28,28%** — pero incluye **2,45% de INS Riesgos del Trabajo**, y esa póliza
 * **ya la paga aparte**: son ₡8.000 al mes registrados como `POLIZA INS` en la
 * categoría `seguro`. Meter ese 2,45% en esta fórmula lo **contaría dos veces** y
 * le bajaría la utilidad sin que nada haya cambiado.
 *
 * Sacándole el INS, su tabla da **25,83%**, que tampoco es 26,92%: quedan 1,09
 * puntos sin explicar (~₡4.687 al mes).
 *
 * Por eso el valor por defecto es **26,92%: el que reproduce su realidad**.
 * Cambiarlo por iniciativa nuestra alteraría su P&L histórico basándonos en una
 * tabla que no cuadra con sus propios registros. Las tasas son **configurables**
 * justamente para que él las mueva cuando resolvamos esos 1,09 puntos.
 */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { crMidnightMs } from "./lib/dates";

/**
 * Tasas por defecto — las que **reproducen la hoja de Esteban**, verificadas en
 * abril, mayo, junio y julio de 2026.
 *
 * *(Marzo da 31,57% / 8,50% / 3,54%. Él confirmó que fue un error de la hoja, no
 * un ajuste real, así que no se arrastra — B30.)*
 */
export const TASAS_POR_DEFECTO = {
  /** Sobre el salario bruto. NO incluye el INS: esa póliza va aparte. */
  aportePatronalPct: 26.92,
  /** Aguinaldo, preaviso y cesantía comparten tasa y base. */
  provisionPct: 8.33,
  /** Vacaciones usa OTRA base — ver abajo. */
  vacacionesPct: 3.84,
  /** Sobre la base que Esteban decide reportar, no sobre sus ingresos. */
  impuestosPct: 13,
} as const;

/**
 * La FORMA de las tasas, no los valores del default. Con `typeof
 * TASAS_POR_DEFECTO` (que va con `as const`) el tipo sería `26.92` literal, y no
 * se podría pasar ninguna otra tasa — que es justo lo contrario de lo que se
 * quiere: son configurables.
 */
export type Tasas = {
  aportePatronalPct: number;
  provisionPct: number;
  vacacionesPct: number;
  impuestosPct: number;
};

export const tasasValidator = v.object({
  aportePatronalPct: v.number(),
  provisionPct: v.number(),
  vacacionesPct: v.number(),
  impuestosPct: v.number(),
});

/** Las seis líneas derivadas, en el orden en que se muestran. */
export const LINEAS = [
  "aporte_patronal",
  "aguinaldo",
  "preaviso",
  "cesantia",
  "vacaciones",
  "impuestos",
] as const;

export type Linea = (typeof LINEAS)[number];

/** Etiqueta y categoría de finanzas de cada línea. */
export const META_LINEA: Record<Linea, { label: string; category: string }> = {
  aporte_patronal: { label: "Aporte patronal CCSS", category: "salario" },
  aguinaldo: { label: "Provisión aguinaldo", category: "salario" },
  preaviso: { label: "Provisión preaviso", category: "salario" },
  cesantia: { label: "Provisión cesantía", category: "salario" },
  vacaciones: { label: "Provisión vacaciones", category: "salario" },
  impuestos: { label: "Impuestos", category: "impuestos" },
};

export type EntradasPlanilla = {
  /** Salario bruto de Sergio. */
  salarioCRC: number;
  /** Comisiones del mes. */
  comisionesCRC: number;
  /** La base que Esteban decide reportar — la elige él, no la deducimos. */
  baseImponibleCRC: number;
};

export type LineaCalculada = {
  linea: Linea;
  label: string;
  category: string;
  amountCRC: number;
  /** Cómo salió, en palabras. Se muestra en pantalla para que sea auditable. */
  formula: string;
};

/** Colones enteros: es la unidad en la que se registra todo (RF). */
function aColones(n: number): number {
  return Math.round(n);
}

/**
 * Las seis líneas, a partir de los tres datos.
 *
 * Pura y exportada: es la única regla del cálculo y se prueba sin base de datos,
 * contra los números reales de julio.
 *
 * **Ojo con la base de vacaciones**, que es el detalle fácil de perder: las
 * otras tres provisiones se calculan sobre *(salario + comisiones)*, pero
 * vacaciones va sobre *(salario + aporte patronal)* — no lleva comisiones y sí
 * suma la carga. Es exactamente el tipo de cosa que conviene que haga el sistema
 * y no una persona a las once de la noche.
 */
export function calcularPlanilla(
  { salarioCRC, comisionesCRC, baseImponibleCRC }: EntradasPlanilla,
  tasas: Tasas = TASAS_POR_DEFECTO,
): LineaCalculada[] {
  const aportePatronal = aColones(salarioCRC * (tasas.aportePatronalPct / 100));
  const baseProvisiones = salarioCRC + comisionesCRC;
  const provision = aColones(baseProvisiones * (tasas.provisionPct / 100));
  const vacaciones = aColones(
    (salarioCRC + aportePatronal) * (tasas.vacacionesPct / 100),
  );
  const impuestos = aColones(baseImponibleCRC * (tasas.impuestosPct / 100));

  const f = (n: number) => n.toString().replace(".", ",");

  return [
    {
      linea: "aporte_patronal",
      ...META_LINEA.aporte_patronal,
      amountCRC: aportePatronal,
      formula: `${f(tasas.aportePatronalPct)}% × salario`,
    },
    {
      linea: "aguinaldo",
      ...META_LINEA.aguinaldo,
      amountCRC: provision,
      formula: `${f(tasas.provisionPct)}% × (salario + comisiones)`,
    },
    {
      linea: "preaviso",
      ...META_LINEA.preaviso,
      amountCRC: provision,
      formula: `${f(tasas.provisionPct)}% × (salario + comisiones)`,
    },
    {
      linea: "cesantia",
      ...META_LINEA.cesantia,
      amountCRC: provision,
      formula: `${f(tasas.provisionPct)}% × (salario + comisiones)`,
    },
    {
      linea: "vacaciones",
      ...META_LINEA.vacaciones,
      amountCRC: vacaciones,
      formula: `${f(tasas.vacacionesPct)}% × (salario + aporte patronal)`,
    },
    {
      linea: "impuestos",
      ...META_LINEA.impuestos,
      amountCRC: impuestos,
      formula: `${f(tasas.impuestosPct)}% × base a reportar`,
    },
  ];
}

/**
 * Llave de idempotencia de cada línea.
 *
 * Mismo patrón que F5-auto: re-registrar el mismo mes **actualiza** las seis
 * filas en vez de duplicarlas. Es lo que hace seguro corregir el salario y
 * volver a confirmar.
 */
export function llaveDeLinea(yearMonth: string, linea: Linea): string {
  return `planilla:${yearMonth}:${linea}`;
}


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
