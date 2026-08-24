/**
 * Registro de la planilla del mes (B28).
 *
 * Lo que hay que proteger, en orden de qué duele más si falla:
 *
 *  1. **Que corregir no duplique.** Esteban va a equivocarse escribiendo un
 *     salario y va a volver a confirmar. Si eso creara seis líneas más en vez de
 *     actualizar las que ya están, su gasto de planilla se duplicaría y el error
 *     sería casi invisible: doce filas correctas en vez de seis.
 *  2. **Que corregir recalcule TODO.** Cambiar el salario mueve cinco de las seis
 *     líneas. Si alguna se quedara con el número viejo, quedaría una provisión
 *     inconsistente — que es exactamente lo que ya nos pasó con los ₡98.599.
 *  3. **Que nadie las edite a mano.** Se re-derivan; una edición manual se
 *     perdería en silencio en el siguiente recálculo.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const ADMIN = "user_planilla_admin";
const TECNICO = "user_planilla_tecnico";

const JULIO = {
  yearMonth: "2026-07",
  salarioCRC: 430_000,
  comisionesCRC: 73_000,
  baseImponibleCRC: 1_000_000,
};

async function setup() {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [clerkId, role] of [
      [ADMIN, "admin"],
      [TECNICO, "tecnico"],
    ] as const) {
      await ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@example.com`,
        role,
        approvalStatus: "approved",
        createdAt: now,
        updatedAt: now,
      });
    }
  });
  return { t, admin: t.withIdentity({ subject: ADMIN }) };
}

const filasDePlanilla = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) =>
    (await ctx.db.query("finance_entries").collect()).filter(
      (r) => r.source === "planilla" && !r.isDeleted,
    ),
  );

describe("el gate", () => {
  test("un técnico no puede registrar planilla", async () => {
    const { t } = await setup();
    await expect(
      t.withIdentity({ subject: TECNICO }).mutation(api.bi.payroll.registrarPlanilla, JULIO),
    ).rejects.toThrow(/administrador/i);
    expect(await filasDePlanilla(t)).toHaveLength(0);
  });

  test("sin sesión tampoco", async () => {
    const { t } = await setup();
    await expect(
      t.mutation(api.bi.payroll.registrarPlanilla, JULIO),
    ).rejects.toThrow();
  });
});

describe("registrar el mes", () => {
  test("crea las seis líneas con los montos de julio", async () => {
    const { t, admin } = await setup();
    const res = await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);

    expect(res.creadas).toBe(6);
    expect(res.actualizadas).toBe(0);
    expect(res.totalCRC).toBe(115_756 + 41_900 * 3 + 20_957 + 130_000);

    const filas = await filasDePlanilla(t);
    expect(filas).toHaveLength(6);
    // Todas al último día del mes, como las que vinieron de la hoja.
    expect(new Set(filas.map((f) => f.yearMonth))).toEqual(new Set(["2026-07"]));
  });

  test("las provisiones van a `salario` y los impuestos a `impuestos`", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const filas = await filasDePlanilla(t);
    expect(filas.filter((f) => f.category === "salario")).toHaveLength(5);
    expect(filas.filter((f) => f.category === "impuestos")).toHaveLength(1);
  });

  test("guarda los insumos y se pueden volver a leer", async () => {
    const { admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);

    const leido = await admin.query(api.bi.payroll.planillaDelMes, {
      yearMonth: "2026-07",
    });
    expect(leido.insumos).not.toBeNull();
    expect(leido.insumos!.salarioCRC).toBe(430_000);
    expect(leido.insumos!.comisionesCRC).toBe(73_000);
    expect(leido.lineas).toHaveLength(6);
  });

  test("un mes sin registrar devuelve insumos en null, no un error", async () => {
    const { admin } = await setup();
    const leido = await admin.query(api.bi.payroll.planillaDelMes, {
      yearMonth: "2026-01",
    });
    expect(leido.insumos).toBeNull();
    expect(leido.lineas).toEqual([]);
  });
});

describe("corregir el mes — lo que más duele si falla", () => {
  test("volver a confirmar ACTUALIZA, no duplica", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const segunda = await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);

    expect(segunda.creadas).toBe(0);
    expect(segunda.actualizadas).toBe(6);
    expect(await filasDePlanilla(t)).toHaveLength(6); // sigue siendo seis
  });

  test("corregir el salario recalcula las CINCO líneas que dependen de él", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    await admin.mutation(api.bi.payroll.registrarPlanilla, {
      ...JULIO,
      salarioCRC: 500_000,
    });

    const filas = await filasDePlanilla(t);
    expect(filas).toHaveLength(6);
    const porLlave = new Map(filas.map((f) => [f.externalKey, f.amountCRC]));
    expect(porLlave.get("planilla:2026-07:aporte_patronal")).toBe(
      Math.round(500_000 * 0.2692),
    );
    // Y vacaciones, que depende del aporte patronal recién recalculado.
    expect(porLlave.get("planilla:2026-07:vacaciones")).toBe(
      Math.round((500_000 + Math.round(500_000 * 0.2692)) * 0.0384),
    );
    // Los impuestos NO dependen del salario: se quedan igual.
    expect(porLlave.get("planilla:2026-07:impuestos")).toBe(130_000);
  });

  test("las tres provisiones que valen igual siguen siendo TRES filas", async () => {
    // Comparten monto; si compartieran llave, el gasto se subestimaría en dos
    // tercios y las cifras seguirían pareciendo razonables.
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const filas = await filasDePlanilla(t);
    const de41900 = filas.filter((f) => f.amountCRC === 41_900);
    expect(de41900).toHaveLength(3);
    expect(new Set(de41900.map((f) => f.externalKey)).size).toBe(3);
  });

  test("meses distintos no se pisan entre sí", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    await admin.mutation(api.bi.payroll.registrarPlanilla, {
      ...JULIO,
      yearMonth: "2026-08",
      salarioCRC: 450_000,
    });
    expect(await filasDePlanilla(t)).toHaveLength(12);
  });
});

describe("las seis no se editan a mano", () => {
  test("el listado las marca como no editables", async () => {
    const { admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const filas = await admin.query(api.bi.financeForm.listFinanceEntries, {});
    const dePlanilla = filas.filter((f) => f.source === "planilla");
    expect(dePlanilla).toHaveLength(6);
    for (const f of dePlanilla) expect(f.editable, f.note ?? "").toBe(false);
  });

  test("el formulario rechaza editarlas y borrarlas", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const una = (await filasDePlanilla(t))[0];

    await expect(
      admin.mutation(api.bi.financeForm.updateFinanceEntry, {
        id: una._id,
        kind: "expense",
        category: "salario",
        amountCRC: 1,
        originalCurrency: "CRC",
        date: una.date,
      } as never),
    ).rejects.toThrow();

    await expect(
      admin.mutation(api.bi.financeForm.deleteFinanceEntry, { id: una._id }),
    ).rejects.toThrow();
  });
});

describe("validación de entradas", () => {
  test("un mes con formato inválido se rechaza", async () => {
    const { t, admin } = await setup();
    for (const yearMonth of ["2026-13", "julio", "2026/07", "26-07", "2026-7"]) {
      await expect(
        admin.mutation(api.bi.payroll.registrarPlanilla, { ...JULIO, yearMonth }),
        yearMonth,
      ).rejects.toThrow(/mes inválido/i);
    }
    expect(await filasDePlanilla(t)).toHaveLength(0);
  });

  test("montos negativos se rechazan y no dejan nada a medias", async () => {
    const { t, admin } = await setup();
    await expect(
      admin.mutation(api.bi.payroll.registrarPlanilla, {
        ...JULIO,
        salarioCRC: -1,
      }),
    ).rejects.toThrow(/negativo/i);
    expect(await filasDePlanilla(t)).toHaveLength(0);
  });

  test("acepta tasas distintas y las guarda con el mes", async () => {
    // Se congelan por mes: si mañana cambian, los meses viejos siguen
    // explicándose con las que se usaron.
    const { admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, {
      ...JULIO,
      tasas: {
        aportePatronalPct: 25.83,
        provisionPct: 8.33,
        vacacionesPct: 3.84,
        impuestosPct: 13,
      },
    });
    const leido = await admin.query(api.bi.payroll.planillaDelMes, {
      yearMonth: "2026-07",
    });
    expect(leido.insumos!.tasas.aportePatronalPct).toBe(25.83);
    expect(leido.lineas[0].amountCRC).toBe(Math.round(430_000 * 0.2583));
  });
});
