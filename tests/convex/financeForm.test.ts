/**
 * QA de la captura manual de finanzas (F5/F6) — el camino de escritura que usa
 * Esteban desde el tablero.
 *
 * Se prueba acá y no a mano porque todas las funciones exigen sesión admin
 * (`requireAdmin`): desde el CLI no hay identidad, y en el navegador solo podría
 * hacerlo alguien con cuenta. `convex-test` sí puede suplantar identidad.
 *
 * Cubre las reglas compartidas con el loader de migración (A39): allow-list de
 * categorías (RF-11), viático forzado (B22) y tipo de cambio en USD; más la
 * convención de fecha (medianoche de Costa Rica) y el **borrado suave**, que
 * nunca debe ser un borrado real ni seguir contando en los totales.
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

const ADMIN = "user_test_finance_admin";
const TECNICO = "user_test_finance_tecnico";

/** Deja sembrados un admin y un técnico, y devuelve el contexto de cada uno. */
async function setup() {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("users", {
      clerkId: ADMIN,
      email: "admin-finanzas@example.com",
      role: "admin",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("users", {
      clerkId: TECNICO,
      email: "tecnico-finanzas@example.com",
      role: "tecnico",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    });
  });
  return {
    t,
    asAdmin: t.withIdentity({ subject: ADMIN }),
    asTecnico: t.withIdentity({ subject: TECNICO }),
  };
}

/** Alta mínima válida; los campos que interesen se sobrescriben por prueba. */
const gastoBase = {
  kind: "expense" as const,
  category: "comida",
  originalAmount: 9800,
  originalCurrency: "CRC" as const,
  date: "2026-07-15",
  isViatico: true,
};

describe("createFinanceEntry", () => {
  test("alta en colones: normaliza y marca origen manual", async () => {
    const { t, asAdmin } = await setup();
    const { id } = await asAdmin.mutation(
      api.bi.financeForm.createFinanceEntry,
      gastoBase,
    );

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row).not.toBeNull();
    expect(row!.amountCRC).toBe(9800);
    expect(row!.originalCurrency).toBe("CRC");
    expect(row!.fxRate).toBeUndefined(); // en colones no se guarda tipo de cambio
    expect(row!.source).toBe("manual");
    expect(row!.createdBy).toBe(ADMIN);
    expect(row!.isDeleted).toBe(false);
    expect(row!.externalKey).toBeUndefined(); // la llave del Sheet no se toca
  });

  test("la fecha se guarda como medianoche de Costa Rica y el periodo sale de ahí", async () => {
    const { t, asAdmin } = await setup();
    // 1-ago en CR son las 06:00 UTC: si el periodo se calculara en UTC, un
    // movimiento del último día del mes podría caer en el mes equivocado.
    const { id } = await asAdmin.mutation(api.bi.financeForm.createFinanceEntry, {
      ...gastoBase,
      date: "2026-08-01",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.date).toBe(Date.parse("2026-08-01T00:00:00-06:00"));
    expect(row!.yearMonth).toBe("2026-08");
  });

  test("el último día del mes no se corre al mes siguiente", async () => {
    const { t, asAdmin } = await setup();
    const { id } = await asAdmin.mutation(api.bi.financeForm.createFinanceEntry, {
      ...gastoBase,
      date: "2026-07-31",
    });
    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.yearMonth).toBe("2026-07");
  });

  test("alta en dólares: convierte a colones con el tipo de cambio", async () => {
    const { t, asAdmin } = await setup();
    const { id } = await asAdmin.mutation(api.bi.financeForm.createFinanceEntry, {
      ...gastoBase,
      kind: "income",
      category: "inspeccion",
      isViatico: false,
      originalAmount: 135,
      originalCurrency: "USD",
      fxRate: 510,
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.amountCRC).toBe(68_850); // 135 × 510
    expect(row!.originalAmount).toBe(135);
    expect(row!.fxRate).toBe(510);
  });

  test("rechaza dólares sin tipo de cambio", async () => {
    const { asAdmin } = await setup();
    await expect(
      asAdmin.mutation(api.bi.financeForm.createFinanceEntry, {
        ...gastoBase,
        originalCurrency: "USD",
      }),
    ).rejects.toThrow(/tipo de cambio/i);
  });

  test("rechaza montos de cero o negativos", async () => {
    const { asAdmin } = await setup();
    for (const originalAmount of [0, -1500]) {
      await expect(
        asAdmin.mutation(api.bi.financeForm.createFinanceEntry, {
          ...gastoBase,
          originalAmount,
        }),
      ).rejects.toThrow(/mayor a 0/i);
    }
  });

  test("rechaza una categoría que no corresponde al tipo de movimiento", async () => {
    const { asAdmin } = await setup();
    // "salario" es de gasto; como ingreso no debe pasar.
    await expect(
      asAdmin.mutation(api.bi.financeForm.createFinanceEntry, {
        ...gastoBase,
        kind: "income",
        category: "salario",
      }),
    ).rejects.toThrow(/categoría inválida/i);
  });

  test("B22: salario e impuestos nunca quedan como viático, aunque se pidan", async () => {
    const { t, asAdmin } = await setup();
    for (const category of ["salario", "impuestos"]) {
      const { id } = await asAdmin.mutation(
        api.bi.financeForm.createFinanceEntry,
        { ...gastoBase, category, isViatico: true },
      );
      const row = await t.run(async (ctx) => ctx.db.get(id));
      expect(row!.isViatico).toBe(false);
    }
  });
});

describe("updateFinanceEntry", () => {
  test("recalcula periodo y limpia el tipo de cambio al pasar de dólares a colones", async () => {
    const { t, asAdmin } = await setup();
    const { id } = await asAdmin.mutation(api.bi.financeForm.createFinanceEntry, {
      ...gastoBase,
      originalAmount: 100,
      originalCurrency: "USD",
      fxRate: 500,
    });

    await asAdmin.mutation(api.bi.financeForm.updateFinanceEntry, {
      id,
      ...gastoBase,
      originalAmount: 12_000,
      originalCurrency: "CRC",
      date: "2026-09-02",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.amountCRC).toBe(12_000);
    expect(row!.originalCurrency).toBe("CRC");
    expect(row!.fxRate).toBeUndefined();
    expect(row!.yearMonth).toBe("2026-09");
    expect(row!.source).toBe("manual"); // no se altera el origen
    expect(row!.createdBy).toBe(ADMIN);
  });

  test("no permite editar un movimiento ya eliminado", async () => {
    const { asAdmin } = await setup();
    const { id } = await asAdmin.mutation(
      api.bi.financeForm.createFinanceEntry,
      gastoBase,
    );
    await asAdmin.mutation(api.bi.financeForm.deleteFinanceEntry, { id });

    await expect(
      asAdmin.mutation(api.bi.financeForm.updateFinanceEntry, {
        id,
        ...gastoBase,
      }),
    ).rejects.toThrow(/no encontrada o eliminada/i);
  });
});

describe("deleteFinanceEntry (borrado suave)", () => {
  test("marca la fila sin borrarla y la saca del listado", async () => {
    const { t, asAdmin } = await setup();
    const { id } = await asAdmin.mutation(
      api.bi.financeForm.createFinanceEntry,
      gastoBase,
    );

    await asAdmin.mutation(api.bi.financeForm.deleteFinanceEntry, { id });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row).not.toBeNull(); // nunca es un borrado real
    expect(row!.isDeleted).toBe(true);

    const listado = await asAdmin.query(api.bi.financeForm.listFinanceEntries, {});
    expect(listado.find((e) => e.id === id)).toBeUndefined();
  });

  test("borrar dos veces no falla ni cambia nada", async () => {
    const { asAdmin } = await setup();
    const { id } = await asAdmin.mutation(
      api.bi.financeForm.createFinanceEntry,
      gastoBase,
    );
    await asAdmin.mutation(api.bi.financeForm.deleteFinanceEntry, { id });
    await expect(
      asAdmin.mutation(api.bi.financeForm.deleteFinanceEntry, { id }),
    ).resolves.toEqual({ id });
  });

  test("un movimiento eliminado deja de contar en los totales del tablero", async () => {
    const { asAdmin } = await setup();
    await asAdmin.mutation(api.bi.financeForm.createFinanceEntry, {
      ...gastoBase,
      kind: "income",
      category: "inspeccion",
      isViatico: false,
      originalAmount: 50_000,
    });
    const { id } = await asAdmin.mutation(
      api.bi.financeForm.createFinanceEntry,
      { ...gastoBase, originalAmount: 10_000 },
    );

    const antes = await asAdmin.query(api.bi.public.financeSummary, {});
    expect(antes.totals.income).toBe(50_000);
    expect(antes.totals.expense).toBe(10_000);
    expect(antes.totals.utilidad).toBe(40_000);

    await asAdmin.mutation(api.bi.financeForm.deleteFinanceEntry, { id });

    const despues = await asAdmin.query(api.bi.public.financeSummary, {});
    expect(despues.totals.expense).toBe(0);
    expect(despues.totals.utilidad).toBe(50_000);
    expect(despues.totals.rows).toBe(1);
  });
});

describe("permisos", () => {
  test("un técnico no puede registrar ni leer finanzas", async () => {
    const { asTecnico } = await setup();

    await expect(
      asTecnico.mutation(api.bi.financeForm.createFinanceEntry, gastoBase),
    ).rejects.toThrow(/administrador/i);

    await expect(
      asTecnico.query(api.bi.financeForm.listFinanceEntries, {}),
    ).rejects.toThrow(/administrador/i);

    await expect(
      asTecnico.query(api.bi.public.financeSummary, {}),
    ).rejects.toThrow(/administrador/i);
  });

  test("sin sesión no se puede registrar", async () => {
    const { t } = await setup();
    await expect(
      t.mutation(api.bi.financeForm.createFinanceEntry, gastoBase),
    ).rejects.toThrow(/no autenticado/i);
  });
});
