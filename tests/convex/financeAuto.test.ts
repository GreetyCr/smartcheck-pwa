/**
 * QA de la auto-captura del cobro (F5-auto): la inspección entregada genera
 * sola sus movimientos de finanzas.
 *
 * Se prueba acá porque el camino real solo se dispara al entregar un reporte en
 * la app, y lo que importa no es que "escriba algo" sino tres cosas que no se
 * ven a simple vista: que el ingreso quede **bruto** (netear rompería la
 * conciliación), que sea **idempotente y re-derivable** (la fila se corrige
 * sola si el monto de la inspección cambia, sin duplicar), y que un reporte que
 * vuelve atrás **retire** su movimiento con borrado suave en vez de dejar
 * ingreso fantasma.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const ADMIN = "user_test_auto_admin";

/** Entrega a mediodía CR del 15-jul-2026 (fecha neutra para los casos base). */
const ENTREGA = Date.parse("2026-07-15T12:00:00-06:00");

async function setup() {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("users", {
      clerkId: ADMIN,
      email: "admin-auto@example.com",
      role: "admin",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    });
  });
  return { t, asAdmin: t.withIdentity({ subject: ADMIN }) };
}

/** Inspección entregada; los campos que interesen se sobrescriben por prueba. */
async function seedInspection(
  t: Awaited<ReturnType<typeof setup>>["t"],
  overrides: Record<string, unknown> = {},
): Promise<Id<"inspections">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("inspections", {
      clientName: "Ana Fernández",
      vehicleBrand: "Hyundai",
      vehicleModel: "Tucson",
      vehicleYear: 2021,
      status: "report_delivered",
      reportDeliveredAt: ENTREGA,
      totalAmountCharged: 59_000,
      ...overrides,
    }),
  );
}

/** Movimientos vivos ligados a una inspección. */
async function entriesFor(
  t: Awaited<ReturnType<typeof setup>>["t"],
  inspectionId: Id<"inspections">,
) {
  return await t.run(async (ctx) => {
    const all = await ctx.db.query("finance_entries").collect();
    return all.filter((e) => e.linkedInspectionId === inspectionId);
  });
}

const sync = (
  t: Awaited<ReturnType<typeof setup>>["t"],
  inspectionId: Id<"inspections">,
) => t.mutation(internal.bi.financeAuto.syncFromInspection, { inspectionId });

describe("F5-auto — ingreso derivado de la inspección entregada", () => {
  test("una entrega sin comisión genera un solo ingreso, por el monto cobrado", async () => {
    const { t } = await setup();
    const id = await seedInspection(t);

    const res = await sync(t, id);
    expect(res.income).toBe("inserted");
    expect(res.comision).toBe("none");

    const rows = await entriesFor(t, id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "income",
      category: "inspeccion",
      amountCRC: 59_000,
      source: "inspection",
      isViatico: false,
      isDeleted: false,
    });
  });

  test("con comisión, el ingreso queda BRUTO y la comisión va como gasto aparte", async () => {
    const { t } = await setup();
    const id = await seedInspection(t, {
      biCommission: "si",
      commissionFeeAmount: 5_000,
    });

    await sync(t, id);
    const rows = await entriesFor(t, id);

    const ingreso = rows.find((r) => r.kind === "income");
    const comision = rows.find((r) => r.kind === "expense");

    // Lo que NO debe pasar: guardar 54.000 neteado. La conciliación compara
    // contra totalAmountCharged (59.000) y vería un gap permanente.
    expect(ingreso?.amountCRC).toBe(59_000);
    expect(comision?.amountCRC).toBe(5_000);
    expect(comision?.category).toBe("comision");
    expect(comision?.isViatico).toBe(false);
  });

  test("correrlo dos veces no duplica: es idempotente", async () => {
    const { t } = await setup();
    const id = await seedInspection(t, { commissionFeeAmount: 5_000 });

    await sync(t, id);
    const segunda = await sync(t, id);

    expect(segunda.income).toBe("updated");
    expect(segunda.comision).toBe("updated");
    expect(await entriesFor(t, id)).toHaveLength(2);
  });

  test("si se corrige el monto en la inspección, la fila se re-deriva", async () => {
    const { t } = await setup();
    const id = await seedInspection(t);
    await sync(t, id);

    await t.run(async (ctx) => {
      await ctx.db.patch(id, { totalAmountCharged: 72_000 });
    });
    await sync(t, id);

    const rows = await entriesFor(t, id);
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCRC).toBe(72_000);
  });

  test("si la comisión desaparece, su gasto se retira con borrado SUAVE", async () => {
    const { t } = await setup();
    const id = await seedInspection(t, { commissionFeeAmount: 5_000 });
    await sync(t, id);

    await t.run(async (ctx) => {
      await ctx.db.patch(id, { commissionFeeAmount: 0 });
    });
    const res = await sync(t, id);

    expect(res.comision).toBe("retired");
    const rows = await entriesFor(t, id);
    const comision = rows.find((r) => r.kind === "expense");
    // La fila SOBREVIVE marcada, no se borra: el movimiento retirado sigue auditable.
    expect(comision).toBeDefined();
    expect(comision?.isDeleted).toBe(true);
  });

  test("un reporte que aún no se entrega no genera nada", async () => {
    const { t } = await setup();
    const id = await seedInspection(t, {
      status: "synced",
      reportDeliveredAt: undefined,
    });

    const res = await sync(t, id);
    expect(res.reason).toBe("no_entregado");
    expect(await entriesFor(t, id)).toHaveLength(0);
  });

  test("si la inspección vuelve atrás, el ingreso se retira (no queda fantasma)", async () => {
    const { t } = await setup();
    const id = await seedInspection(t);
    await sync(t, id);

    await t.run(async (ctx) => {
      await ctx.db.patch(id, { status: "synced" });
    });
    const res = await sync(t, id);

    expect(res.income).toBe("retired");
    const rows = await entriesFor(t, id);
    expect(rows[0].isDeleted).toBe(true);
  });

  test("un monto placeholder (≤ ₡1.000, B15) no genera ingreso y deja un issue", async () => {
    const { t } = await setup();
    const id = await seedInspection(t, { totalAmountCharged: 1_000 });

    const res = await sync(t, id);
    expect(res.reason).toBe("monto_placeholder");
    expect(await entriesFor(t, id)).toHaveLength(0);

    const issues = await t.run(async (ctx) =>
      ctx.db.query("bi_quality_issues").collect(),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].issueType).toBe("zero_revenue");
  });

  test("el issue del placeholder no se acumula al reintentar", async () => {
    const { t } = await setup();
    const id = await seedInspection(t, { totalAmountCharged: 0 });

    await sync(t, id);
    await sync(t, id);

    const issues = await t.run(async (ctx) =>
      ctx.db.query("bi_quality_issues").collect(),
    );
    expect(issues).toHaveLength(1);
  });

  test("el periodo se calcula en zona CR: 23:30 del último día cae en ese mes", async () => {
    const { t } = await setup();
    // 31-jul 23:30 en Costa Rica ya es 1-ago en UTC. Debe contar como julio.
    const id = await seedInspection(t, {
      reportDeliveredAt: Date.parse("2026-07-31T23:30:00-06:00"),
    });

    await sync(t, id);
    const rows = await entriesFor(t, id);
    expect(rows[0].yearMonth).toBe("2026-07");
  });

  test("el ingreso automático cuenta en el resumen de finanzas", async () => {
    const { t, asAdmin } = await setup();
    const id = await seedInspection(t, { commissionFeeAmount: 5_000 });
    await sync(t, id);

    const resumen = await asAdmin.query(api.bi.public.financeSummary, {});
    expect(resumen.totals.income).toBe(59_000);
    expect(resumen.totals.expense).toBe(5_000);
    expect(resumen.totals.utilidad).toBe(54_000);
  });
});

describe("F5-auto — las filas del sistema no se editan a mano", () => {
  test("editar una fila automática se rechaza con un mensaje que dice qué hacer", async () => {
    const { t, asAdmin } = await setup();
    const id = await seedInspection(t);
    await sync(t, id);
    const rows = await entriesFor(t, id);

    await expect(
      asAdmin.mutation(api.bi.financeForm.updateFinanceEntry, {
        id: rows[0]._id,
        kind: "income",
        category: "inspeccion",
        originalAmount: 1,
        originalCurrency: "CRC",
        date: "2026-07-15",
        isViatico: false,
      }),
    ).rejects.toThrow(/genera el sistema/i);
  });

  test("borrar una fila automática también se rechaza", async () => {
    const { t, asAdmin } = await setup();
    const id = await seedInspection(t);
    await sync(t, id);
    const rows = await entriesFor(t, id);

    await expect(
      asAdmin.mutation(api.bi.financeForm.deleteFinanceEntry, {
        id: rows[0]._id,
      }),
    ).rejects.toThrow(/genera el sistema/i);
  });

  test("el listado marca la fila automática como no editable", async () => {
    const { t, asAdmin } = await setup();
    const id = await seedInspection(t);
    await sync(t, id);

    const listado = await asAdmin.query(api.bi.financeForm.listFinanceEntries, {});
    expect(listado).toHaveLength(1);
    expect(listado[0].source).toBe("inspection");
    expect(listado[0].editable).toBe(false);
  });
});
