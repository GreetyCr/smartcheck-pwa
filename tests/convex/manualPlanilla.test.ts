/**
 * Los pasos del manual de Esteban, ejecutados — capítulo «3 · Planilla».
 *
 * Por qué NO se probó en el panel
 * ------------------------------
 * Se propuso registrar un mes futuro vacío y después dar de baja las líneas.
 * **No se puede deshacer:** `deleteFinanceEntry` rechaza las filas con
 * `source === "planilla"` igual que las automáticas, porque se re-derivan de los
 * datos del mes. Quitarlas exigiría escribir y desplegar una mutación nueva solo
 * para limpiar, o editar la base a mano.
 *
 * O sea que la prueba «reversible» que se propuso **no era reversible**, y eso
 * había que comprobarlo antes de pedirle a nadie que la hiciera. Acá se ejecuta
 * el mismo flujo contra las mutaciones reales, sin tocar la contabilidad.
 *
 * **Lo que esto NO cubre:** que el botón cambie de nombre en pantalla, que el
 * recuadro rojo del mes bloqueado se vea, y que las casillas se llenen solas al
 * elegir un mes ya registrado. Eso es interfaz.
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

const ADMIN = "user_test_planilla_admin";
/** Un mes futuro y vacío, igual que la prueba que se iba a hacer a mano. */
const MES = "2027-03";

async function setup() {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("users", {
      clerkId: ADMIN,
      email: "planilla@example.com",
      role: "admin",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    });
  });
  return t.withIdentity({ subject: ADMIN });
}

const DATOS = {
  yearMonth: MES,
  salarioCRC: 430_000,
  comisionesCRC: 73_000,
  baseImponibleCRC: 1_000_000,
  feriadosDias: 0,
};

describe("capítulo 3 · «Cómo registrar el mes»", () => {
  test("paso 8: al confirmar, las líneas entran a Finanzas con la fecha del mes", async () => {
    const asAdmin = await setup();
    const res = await asAdmin.mutation(api.bi.payroll.registrarPlanilla, DATOS);

    expect(res.creadas).toBeGreaterThanOrEqual(7);
    expect(res.actualizadas).toBe(0);

    const filas = await asAdmin.query(api.bi.financeForm.listFinanceEntries, {
      yearMonth: MES,
    });
    // «Las ocho o nueve líneas entran a Finanzas como gasto, con la fecha del
    // mes que elegiste.»
    expect(filas.length).toBe(res.creadas);
    expect(filas.every((f) => f.kind === "expense")).toBe(true);
    expect(filas.every((f) => f.yearMonth === MES)).toBe(true);
  });

  test("«no hace falta anotar el salario por otro lado»", async () => {
    // Es la advertencia más cara del capítulo: anotarlo a mano además de acá lo
    // contaría dos veces. La única defensa es que la planilla YA lo incluya.
    const asAdmin = await setup();
    await asAdmin.mutation(api.bi.payroll.registrarPlanilla, DATOS);

    const filas = await asAdmin.query(api.bi.financeForm.listFinanceEntries, {
      yearMonth: MES,
    });
    const total = filas.reduce((s, f) => s + f.amountCRC, 0);

    expect(filas.some((f) => f.category === "salario")).toBe(true);
    expect(total).toBeGreaterThan(DATOS.salarioCRC);
  });

  test("«confirmar otra vez corrige las líneas; no las duplica»", async () => {
    const asAdmin = await setup();
    const primera = await asAdmin.mutation(
      api.bi.payroll.registrarPlanilla,
      DATOS,
    );
    const segunda = await asAdmin.mutation(api.bi.payroll.registrarPlanilla, {
      ...DATOS,
      comisionesCRC: 90_000,
    });

    expect(segunda.creadas).toBe(0);
    expect(segunda.actualizadas).toBe(primera.creadas);

    const filas = await asAdmin.query(api.bi.financeForm.listFinanceEntries, {
      yearMonth: MES,
    });
    expect(filas.length).toBe(primera.creadas);
  });

  test("las líneas quedan bloqueadas en Finanzas — y por eso esto no se prueba en producción", async () => {
    // El capítulo dice: «Las líneas de planilla no se editan desde Finanzas.
    // Aparecen ahí marcadas como calculadas y con los botones apagados.»
    //
    // Es también la razón por la que la prueba a mano se descartó: lo que se
    // crea acá **no se puede sacar desde el panel**.
    const asAdmin = await setup();
    await asAdmin.mutation(api.bi.payroll.registrarPlanilla, DATOS);

    const filas = await asAdmin.query(api.bi.financeForm.listFinanceEntries, {
      yearMonth: MES,
    });
    expect(filas.every((f) => f.editable === false)).toBe(true);

    await expect(
      asAdmin.mutation(api.bi.financeForm.deleteFinanceEntry, {
        id: filas[0].id,
      }),
    ).rejects.toThrow();
  });
});

describe("capítulo 3 · «Por qué a veces el mes aparece bloqueado»", () => {
  test("un mes que ya trae líneas por otra vía se rechaza en vez de duplicar", async () => {
    // «Registrar el mes acá las duplicaría en vez de corregirlas, porque son
    // registros distintos.» El servidor lo impide; la pantalla lo avisa antes.
    const asAdmin = await setup();
    await asAdmin.run(async (ctx) => {
      await ctx.db.insert("finance_entries", {
        kind: "expense",
        category: "salario",
        amountCRC: 430_000,
        originalAmount: 430_000,
        originalCurrency: "CRC",
        date: Date.parse("2027-03-15T06:00:00.000Z"),
        yearMonth: MES,
        isViatico: false,
        source: "sheet",
        externalKey: `sheet:MARZO 2027:APORTE PATRONO CCSS`,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asAdmin.mutation(api.bi.payroll.registrarPlanilla, DATOS),
    ).rejects.toThrow(/ya tiene .* línea/);
  });
});
