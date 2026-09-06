/**
 * Los pasos del manual de Esteban, ejecutados — capítulo «2 · Finanzas».
 *
 * Por qué existe
 * --------------
 * El manual promete cosas concretas después de cada botón: «el movimiento
 * aparece en la lista de abajo», «las cuatro tarjetas de arriba se recalculan
 * solas», «deja de contar en los totales, pero no se borra». **Un manual con un
 * paso que nadie probó es peor que no tenerlo**, y esas frases no las protegía
 * ninguna prueba: las de `financeForm.test.ts` cubren las reglas del alta y del
 * borrado, no la secuencia que el documento le pide seguir.
 *
 * Se intentó hacerlo a mano en producción, con un movimiento de ₡1, y **no se
 * pudo**: las tres mutaciones exigen sesión de admin de Clerk, y ni el CLI de
 * Convex ni el navegador de la herramienta pueden abrir una. Esto ejecuta la
 * misma secuencia contra las mutaciones reales, con identidad de admin, sin
 * tocar la contabilidad del cliente.
 *
 * **Lo que esta prueba NO cubre:** que el panel de la derecha se abra, que los
 * campos se llamen como dice el manual y que la tabla se refresque sola. Eso es
 * interfaz y hay que verlo con los ojos. Sigue pendiente que alguien haga el
 * ₡1 de verdad en el panel.
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

const ADMIN = "user_test_manual_admin";

async function setup() {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("users", {
      clerkId: ADMIN,
      email: "manual@example.com",
      role: "admin",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    });
  });
  return t.withIdentity({ subject: ADMIN });
}

/** El movimiento de prueba que el manual describe: ₡1, para no mover nada. */
const DE_PRUEBA = {
  kind: "expense" as const,
  category: "otros",
  originalAmount: 1,
  originalCurrency: "CRC" as const,
  date: "2026-09-06",
  isViatico: false,
  note: "Prueba del manual — dar de baja",
};

describe("capítulo 2 · los diez pasos de «Cómo anotar un movimiento»", () => {
  test("paso 10: al guardar, el movimiento aparece en la lista", async () => {
    const asAdmin = await setup();
    const { id } = await asAdmin.mutation(
      api.bi.financeForm.createFinanceEntry,
      DE_PRUEBA,
    );

    const filas = await asAdmin.query(api.bi.financeForm.listFinanceEntries, {
      yearMonth: "2026-09",
    });
    const mio = filas.find((r) => r.id === id);

    expect(mio).toBeDefined();
    expect(mio!.amountCRC).toBe(1);
    // El manual dice «Se guarda como captura manual»: eso es lo que habilita
    // editarla después. Las del sistema no se pueden tocar.
    expect(mio!.source).toBe("manual");
    expect(mio!.editable).toBe(true);
  });

  test("paso 7: la fecha manda el movimiento a SU mes, no al de hoy", async () => {
    // «Es la fecha del movimiento, no la de hoy. Si pagás hoy la publicidad de
    // agosto, la fecha va en agosto.» Es la advertencia más cara del capítulo:
    // un gasto en el mes equivocado hace ver un mes mejor y el otro peor.
    const asAdmin = await setup();
    await asAdmin.mutation(api.bi.financeForm.createFinanceEntry, {
      ...DE_PRUEBA,
      date: "2026-08-31",
    });

    const agosto = await asAdmin.query(api.bi.financeForm.listFinanceEntries, {
      yearMonth: "2026-08",
    });
    const setiembre = await asAdmin.query(
      api.bi.financeForm.listFinanceEntries,
      { yearMonth: "2026-09" },
    );

    expect(agosto).toHaveLength(1);
    expect(setiembre).toHaveLength(0);
  });

  test("«las cuatro tarjetas de arriba se recalculan solas»", async () => {
    const asAdmin = await setup();
    const antes = await asAdmin.query(api.bi.public.financeSummary, {});

    await asAdmin.mutation(api.bi.financeForm.createFinanceEntry, DE_PRUEBA);
    const despues = await asAdmin.query(api.bi.public.financeSummary, {});

    expect(despues.totals.expense).toBe(antes.totals.expense + 1);
    expect(despues.totals.utilidad).toBe(antes.totals.utilidad - 1);
    // Y el reparto por categoría que arregló A153 tiene que moverse igual: es
    // la misma pasada sobre las mismas filas.
    const otros = despues.porCategoria?.find((c) => c.category === "otros");
    expect(otros?.amountCRC).toBe(1);
  });
});

describe("lo que la tabla dice que hay", () => {
  test("el total de movimientos del periodo NO es el tope de la consulta", async () => {
    // La tabla de «Movimientos» rotulaba «Todo el histórico · 200 filas» con
    // 663 vivos: contaba lo que había llegado, no lo que hay (A155). La cifra
    // correcta sale de `financeSummary`, que recorre todas las filas.
    const asAdmin = await setup();
    for (let i = 0; i < 5; i++) {
      await asAdmin.mutation(api.bi.financeForm.createFinanceEntry, {
        ...DE_PRUEBA,
        note: `movimiento ${i}`,
      });
    }

    const conTope = await asAdmin.query(
      api.bi.financeForm.listFinanceEntries,
      { yearMonth: "2026-09", limit: 2 },
    );
    const resumen = await asAdmin.query(api.bi.public.financeSummary, {});

    expect(conTope).toHaveLength(2);
    expect(resumen.totals.rows).toBe(5);
  });
});

describe("capítulo 2 · «Cómo corregir o dar de baja un movimiento»", () => {
  test("dar de baja lo saca de los totales pero NO lo borra", async () => {
    // «El movimiento deja de contar en los totales, pero no se borra. Queda
    // registrado que existió y que se dio de baja.»
    const asAdmin = await setup();
    const { id } = await asAdmin.mutation(
      api.bi.financeForm.createFinanceEntry,
      DE_PRUEBA,
    );
    const conEl = await asAdmin.query(api.bi.public.financeSummary, {});

    await asAdmin.mutation(api.bi.financeForm.deleteFinanceEntry, { id });

    const sinEl = await asAdmin.query(api.bi.public.financeSummary, {});
    const filas = await asAdmin.query(api.bi.financeForm.listFinanceEntries, {
      yearMonth: "2026-09",
    });

    expect(sinEl.totals.expense).toBe(conEl.totals.expense - 1);
    expect(filas.find((r) => r.id === id)).toBeUndefined();

    // Pero la fila sigue ahí, marcada. Es la mitad que el listado no muestra y
    // que la frase del manual promete.
    const fila = await asAdmin.run(async (ctx) => ctx.db.get(id));
    expect(fila).not.toBeNull();
    expect(fila!.isDeleted).toBe(true);
  });

  test("las filas «automático» no se pueden dar de baja", async () => {
    // «Ojo: las filas que dicen "automático" debajo de la categoría no se
    // pueden editar. Esas las creó el sistema al entregarse un informe.»
    const asAdmin = await setup();
    const id = await asAdmin.run(async (ctx) =>
      ctx.db.insert("finance_entries", {
        kind: "expense",
        category: "comision",
        amountCRC: 5000,
        originalAmount: 5000,
        originalCurrency: "CRC",
        date: Date.parse("2026-09-06T06:00:00.000Z"),
        yearMonth: "2026-09",
        isViatico: false,
        source: "inspection",
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    await expect(
      asAdmin.mutation(api.bi.financeForm.deleteFinanceEntry, { id }),
    ).rejects.toThrow(/no se puede eliminar a mano/);
  });
});
