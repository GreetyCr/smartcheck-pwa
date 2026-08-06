/**
 * QA de `retireEntries` — la otra mitad del loader de finanzas.
 *
 * Lo que se protege: que retirar sea SUAVE (la fila sobrevive y queda
 * auditable), que no se pueda disparar sin pedirlo (dryRun por defecto) y que
 * sea idempotente. Existe porque el loader nunca borra: cuando una línea
 * desaparece del Sheet, su fila queda sumando para siempre.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const FECHA = Date.parse("2026-07-31T00:00:00-06:00");

const base = {
  kind: "expense" as const,
  category: "bonos",
  isViatico: true,
  originalCurrency: "CRC" as const,
  date: FECHA,
  yearMonth: "2026-07",
  isDeleted: false,
  createdAt: FECHA,
  updatedAt: FECHA,
};

async function seed() {
  const t = convexTest(schema, convexModules);
  const ids = await t.run(async (ctx) => ({
    conLlave: await ctx.db.insert("finance_entries", {
      ...base,
      amountCRC: 3_000,
      source: "sheet",
      externalKey: "sheet:JULIO 2026:EXTAS:3",
    }),
    manual: await ctx.db.insert("finance_entries", {
      ...base,
      amountCRC: 300_000,
      category: "otros",
      isViatico: false,
      source: "manual",
      note: "Gastos de la última semana",
    }),
  }));
  return { t, ids };
}

describe("retireEntries", () => {
  test("por defecto NO retira: hay que pedirlo explícitamente", async () => {
    const { t, ids } = await seed();
    const res = await t.mutation(internal.bi.finance.retireEntries, {
      externalKeys: ["sheet:JULIO 2026:EXTAS:3"],
      reason: "prueba",
    });

    expect(res.dryRun).toBe(true);
    expect(res.retired).toHaveLength(1);
    const doc = await t.run(async (ctx) => ctx.db.get(ids.conLlave));
    expect(doc?.isDeleted).toBe(false);
  });

  test("retira por llave externa y por id, y deja el motivo en la nota", async () => {
    const { t, ids } = await seed();
    const res = await t.mutation(internal.bi.finance.retireEntries, {
      externalKeys: ["sheet:JULIO 2026:EXTAS:3"],
      ids: [ids.manual],
      reason: "re-import julio",
      dryRun: false,
    });

    expect(res.retired).toHaveLength(2);
    const docs = await t.run(async (ctx) => [
      await ctx.db.get(ids.conLlave),
      await ctx.db.get(ids.manual),
    ]);
    // Borrado SUAVE: las filas siguen ahí, marcadas.
    expect(docs[0]?.isDeleted).toBe(true);
    expect(docs[1]?.isDeleted).toBe(true);
    expect(docs[1]?.note).toMatch(/retirada: re-import julio/i);
    expect(docs[1]?.amountCRC).toBe(300_000);
  });

  test("no deja de contar dos veces: la retirada sale del resumen", async () => {
    const { t, ids } = await seed();
    const antes = await t.run(async (ctx) => {
      const rows = await ctx.db.query("finance_entries").collect();
      return rows.filter((r) => !r.isDeleted).length;
    });
    await t.mutation(internal.bi.finance.retireEntries, {
      ids: [ids.manual],
      reason: "duplicada",
      dryRun: false,
    });
    const despues = await t.run(async (ctx) => {
      const rows = await ctx.db.query("finance_entries").collect();
      return rows.filter((r) => !r.isDeleted).length;
    });
    expect(despues).toBe(antes - 1);
  });

  test("correrlo de nuevo no vuelve a tocar nada", async () => {
    const { t, ids } = await seed();
    const args = { ids: [ids.manual], reason: "x", dryRun: false };
    await t.mutation(internal.bi.finance.retireEntries, args);
    const segunda = await t.mutation(internal.bi.finance.retireEntries, args);

    expect(segunda.retired).toHaveLength(0);
    expect(segunda.yaEstaban).toBe(1);
  });

  test("una llave que no existe se reporta, no revienta", async () => {
    const { t } = await seed();
    const res = await t.mutation(internal.bi.finance.retireEntries, {
      externalKeys: ["sheet:JULIO 2026:NO EXISTE:1"],
      reason: "x",
      dryRun: false,
    });

    expect(res.retired).toHaveLength(0);
    expect(res.noEncontradas).toEqual(["sheet:JULIO 2026:NO EXISTE:1"]);
  });
});
