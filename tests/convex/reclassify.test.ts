/**
 * QA del saneo de taxonomía del Sheet (cierra los `viatico_review` de QA-2).
 *
 * Lo que se protege acá no es "que reclasifique", sino que la corrección **no
 * mueva la plata**: el gasto total y la utilidad tienen que quedar idénticos,
 * porque lo único que cambia es el desglose por categoría y el flag de viático.
 * Y que se pueda correr dos veces sin volver a tocar nada.
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

const FECHA = Date.parse("2026-04-15T00:00:00-06:00");

/** Reproduce el estado que dejó la carga F1: los dos mapeos malos + uno sano. */
async function seed() {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const base = {
      kind: "expense" as const,
      originalCurrency: "CRC" as const,
      date: FECHA,
      yearMonth: "2026-04",
      source: "sheet" as const,
      isDeleted: false,
      createdAt: FECHA,
      updatedAt: FECHA,
    };
    // Comisión mal puesta en salario.
    await ctx.db.insert("finance_entries", {
      ...base,
      category: "salario",
      isViatico: false,
      amountCRC: 40_000,
      externalKey: "sheet:ABRIL 2026:COMISIONES:1",
    });
    // Impuesto mal puesto en otros Y marcado como viático (el bug caro).
    await ctx.db.insert("finance_entries", {
      ...base,
      category: "otros",
      isViatico: true,
      amountCRC: 483_990,
      externalKey: "sheet:ABRIL 2026:IMPUESTOS:1",
    });
    // Provisión de aguinaldo: payroll bien categorizado, no se toca.
    await ctx.db.insert("finance_entries", {
      ...base,
      category: "salario",
      isViatico: false,
      amountCRC: 200_000,
      externalKey: "sheet:ABRIL 2026:PROVISION AGUINALDO:1",
    });
    await ctx.db.insert("bi_quality_issues", {
      issueType: "viatico_review",
      severity: "info",
      entity: "finance_entries",
      entityRef: "sheet:ABRIL 2026:IMPUESTOS:1",
      detail: "revisar taxonomía viático/payroll 2026",
      runId: "wp4-final",
      detectedAt: FECHA,
      resolved: false,
    });
  });
  return t;
}

const run = (t: Awaited<ReturnType<typeof seed>>, dryRun: boolean) =>
  t.mutation(internal.bi.reclassify.fixSheetTaxonomy, { dryRun });

const gastoTotal = async (t: Awaited<ReturnType<typeof seed>>) =>
  t.run(async (ctx) => {
    const rows = await ctx.db.query("finance_entries").collect();
    return rows
      .filter((r) => !r.isDeleted)
      .reduce((sum, r) => sum + r.amountCRC, 0);
  });

describe("saneo de taxonomía del Sheet", () => {
  test("por defecto NO escribe: hay que pedir explícitamente aplicar", async () => {
    const t = await seed();
    const res = await t.mutation(internal.bi.reclassify.fixSheetTaxonomy, {});

    expect(res.dryRun).toBe(true);
    expect(res.reclasificadas).toHaveLength(2);
    const sinTocar = await t.run(async (ctx) =>
      (await ctx.db.query("finance_entries").collect()).map((r) => r.category),
    );
    expect(sinTocar).toEqual(["salario", "otros", "salario"]);
  });

  test("corrige los dos mapeos malos y deja el payroll sano en paz", async () => {
    const t = await seed();
    await run(t, false);

    const cats = await t.run(async (ctx) =>
      Object.fromEntries(
        (await ctx.db.query("finance_entries").collect()).map((r) => [
          r.externalKey,
          r.category,
        ]),
      ),
    );
    expect(cats["sheet:ABRIL 2026:COMISIONES:1"]).toBe("comision");
    expect(cats["sheet:ABRIL 2026:IMPUESTOS:1"]).toBe("impuestos");
    expect(cats["sheet:ABRIL 2026:PROVISION AGUINALDO:1"]).toBe("salario");
  });

  test("el impuesto deja de contar como viático (B22)", async () => {
    const t = await seed();
    const res = await run(t, false);

    expect(res.viaticosCorregidos).toBe(1);
    expect(res.viaticoMontoLiberado).toBe(483_990);

    const viaticos = await t.run(async (ctx) =>
      (await ctx.db.query("finance_entries").collect()).filter((r) => r.isViatico),
    );
    expect(viaticos).toHaveLength(0);
  });

  test("no mueve la plata: el gasto total queda idéntico", async () => {
    const t = await seed();
    const antes = await gastoTotal(t);
    await run(t, false);
    expect(await gastoTotal(t)).toBe(antes);
  });

  test("los issues quedan resueltos, no borrados", async () => {
    const t = await seed();
    await run(t, false);

    const issues = await t.run(async (ctx) =>
      ctx.db.query("bi_quality_issues").collect(),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].resolved).toBe(true);
  });

  test("correrlo de nuevo no vuelve a tocar nada", async () => {
    const t = await seed();
    await run(t, false);
    const segunda = await run(t, false);

    expect(segunda.reclasificadas).toHaveLength(0);
    expect(segunda.issuesResueltos).toBe(0);
  });
});
