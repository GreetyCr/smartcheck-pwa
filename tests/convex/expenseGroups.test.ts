/**
 * Desglose de «Otros» en grupos con nombre (A61 · A83).
 *
 * Lo que hay que proteger acá **no es la utilidad** —reagrupar no mueve ni un
 * colón, y eso se prueba explícitamente— sino que **nada se pierda ni se
 * clasifique mal en silencio**. Un proveedor nuevo tiene que aparecer en «sin
 * clasificar», no colarse en el grupo equivocado: es la lección de A64 aplicada
 * al revés, haciendo que el hueco sea ruidoso por construcción.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import {
  clasificar,
  etiquetaDeExternalKey,
} from "../../convex/bi/expenseGroups";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const JULIO = Date.parse("2026-07-15T00:00:00-06:00");

function gasto(over: Record<string, unknown> = {}) {
  return {
    kind: "expense" as const,
    category: "otros",
    isViatico: false,
    amountCRC: 10_000,
    originalCurrency: "CRC" as const,
    date: JULIO,
    yearMonth: "2026-07",
    source: "sheet" as const,
    isDeleted: false,
    createdAt: JULIO,
    updatedAt: JULIO,
    ...over,
  };
}

describe("la etiqueta sale de externalKey, no de la nota", () => {
  test("extrae el renglón de la hoja", () => {
    expect(etiquetaDeExternalKey("sheet:JULIO 2026:INCORPORATE:1")).toBe("INCORPORATE");
    expect(etiquetaDeExternalKey("sheet:MAYO 2026:CELULAR KOLBI:3")).toBe("CELULAR KOLBI");
  });

  test("una etiqueta con dos puntos adentro no se parte a la mitad", () => {
    expect(etiquetaDeExternalKey("sheet:JULIO 2026:PAGO: CONTADOR:1")).toBe("PAGO: CONTADOR");
  });

  test("las llaves que no vienen de la hoja no tienen etiqueta", () => {
    // Las que genera el sistema al entregar un reporte, y la captura manual.
    expect(etiquetaDeExternalKey("inspection:abc123:income")).toBeUndefined();
    expect(etiquetaDeExternalKey(undefined)).toBeUndefined();
    expect(etiquetaDeExternalKey("sheet:JULIO 2026")).toBeUndefined();
  });
});

describe("clasificación", () => {
  test("agrupa por la etiqueta de la hoja", () => {
    const casos: Array<[string, string]> = [
      ["sheet:JULIO 2026:INCORPORATE:1", "servicios_profesionales"],
      ["sheet:JULIO 2026:JRC:1", "servicios_profesionales"],
      ["sheet:JULIO 2026:CONTADOR:1", "servicios_profesionales"],
      ["sheet:JULIO 2026:SAFETY CULTURE:1", "software"],
      ["sheet:JULIO 2026:OPEN AI:1", "software"],
      ["sheet:JULIO 2026:MANYCHAT:1", "software"],
      ["sheet:JULIO 2026:CELULAR KOLBI:1", "telefonia"],
      ["sheet:JULIO 2026:CELULAR CLARO:1", "telefonia"],
      ["sheet:JULIO 2026:EQUIPO:1", "equipo"],
    ];
    for (const [key, esperado] of casos) {
      expect(clasificar({ externalKey: key, isViatico: false }), key).toBe(esperado);
    }
  });

  test("«OPEN AI» con espacio calza — el patrón sin espacio no lo hacía", () => {
    // Este caso se descubrió mirando la lista de sin-clasificar, no adivinando.
    expect(clasificar({ externalKey: "sheet:X:OPEN AI:1", isViatico: false })).toBe("software");
  });

  test("el dato estructurado le gana al texto libre", () => {
    // `isViatico` es un campo, la etiqueta es texto. Gana el campo.
    expect(
      clasificar({ externalKey: "sheet:X:INCORPORATE:1", isViatico: true }),
    ).toBe("viaticos_tecnico");
  });

  test("una etiqueta desconocida NO se cuela en un grupo — cae en sin_clasificar", () => {
    // Es la protección central: preferimos un grupo «sin clasificar» visible
    // antes que un proveedor nuevo escondido en el grupo equivocado.
    expect(
      clasificar({ externalKey: "sheet:X:PROVEEDOR NUEVO SA:1", isViatico: false }),
    ).toBe("sin_clasificar");
    expect(clasificar({ isViatico: false })).toBe("sin_clasificar");
    expect(clasificar({ note: "   ", isViatico: false })).toBe("sin_clasificar");
  });

  test("no importan tildes ni mayúsculas", () => {
    expect(clasificar({ externalKey: "sheet:X:viático técnico:1", isViatico: false }))
      .toBe("viaticos_tecnico");
    expect(clasificar({ externalKey: "sheet:X:ViAtIcO:1", isViatico: false }))
      .toBe("viaticos_tecnico");
  });

  test("la nota solo se usa cuando no vino de la hoja", () => {
    expect(clasificar({ note: "pago a Incorporate", isViatico: false }))
      .toBe("servicios_profesionales");
    // Con etiqueta presente, la nota no manda.
    expect(
      clasificar({
        externalKey: "sheet:X:CELULAR KOLBI:1",
        note: "pago a Incorporate",
        isViatico: false,
      }),
    ).toBe("telefonia");
  });
});

describe("el desglose", () => {
  test("la suma de los grupos es EXACTAMENTE el total — no se pierde ni un colón", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      const filas = [
        gasto({ externalKey: "sheet:JULIO 2026:INCORPORATE:1", amountCRC: 350_000 }),
        gasto({ externalKey: "sheet:JULIO 2026:JRC:1", amountCRC: 109_000 }),
        gasto({ externalKey: "sheet:JULIO 2026:OPEN AI:1", amountCRC: 21_717 }),
        gasto({ externalKey: "sheet:JULIO 2026:CELULAR KOLBI:1", amountCRC: 15_000 }),
        gasto({ externalKey: "sheet:JULIO 2026:MISTERIO:1", amountCRC: 7_777 }),
      ];
      for (const f of filas) await ctx.db.insert("finance_entries", f as never);
    });

    const d = await t.query(internal.bi.expenseGroups.expenseBreakdown, {});
    const suma = d.grupos.reduce((a, g) => a + g.amountCRC, 0);
    expect(suma).toBe(d.totalCRC);
    expect(d.totalCRC).toBe(350_000 + 109_000 + 21_717 + 15_000 + 7_777);
    expect(d.totalRows).toBe(5);
  });

  test("lo no clasificado se reporta CON su etiqueta y su monto", async () => {
    // Sin esto, «sin clasificar» sería un número que nadie puede accionar.
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert("finance_entries", gasto({
        externalKey: "sheet:JULIO 2026:PROVEEDOR NUEVO:1", amountCRC: 40_000,
      }) as never);
      await ctx.db.insert("finance_entries", gasto({
        externalKey: "sheet:AGOSTO 2026:PROVEEDOR NUEVO:1", amountCRC: 60_000,
      }) as never);
    });

    const d = await t.query(internal.bi.expenseGroups.expenseBreakdown, {});
    expect(d.sinClasificar).toHaveLength(1);
    expect(d.sinClasificar[0].etiqueta).toBe("PROVEEDOR NUEVO");
    expect(d.sinClasificar[0].rows).toBe(2);
    expect(d.sinClasificar[0].amountCRC).toBe(100_000);
  });

  test("solo mira gastos de «otros» vivos", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert("finance_entries", gasto({
        externalKey: "sheet:X:INCORPORATE:1", amountCRC: 100_000,
      }) as never);
      // Ninguno de estos tres debe entrar.
      await ctx.db.insert("finance_entries", gasto({
        externalKey: "sheet:X:INCORPORATE:2", amountCRC: 999, isDeleted: true,
      }) as never);
      await ctx.db.insert("finance_entries", gasto({
        externalKey: "sheet:X:INCORPORATE:3", amountCRC: 999, category: "salario",
      }) as never);
      await ctx.db.insert("finance_entries", gasto({
        externalKey: "sheet:X:INCORPORATE:4", amountCRC: 999, kind: "income",
      }) as never);
    });

    const d = await t.query(internal.bi.expenseGroups.expenseBreakdown, {});
    expect(d.totalCRC).toBe(100_000);
    expect(d.totalRows).toBe(1);
  });

  test("acepta rango de fechas", async () => {
    const t = convexTest(schema, convexModules);
    const AGOSTO = Date.parse("2026-08-15T00:00:00-06:00");
    await t.run(async (ctx) => {
      await ctx.db.insert("finance_entries", gasto({
        externalKey: "sheet:X:INCORPORATE:1", amountCRC: 100_000, date: JULIO,
      }) as never);
      await ctx.db.insert("finance_entries", gasto({
        externalKey: "sheet:X:INCORPORATE:2", amountCRC: 200_000, date: AGOSTO,
      }) as never);
    });

    const d = await t.query(internal.bi.expenseGroups.expenseBreakdown, {
      fromMs: AGOSTO,
    });
    expect(d.totalCRC).toBe(200_000);
  });

  test("sin movimientos no divide entre cero", async () => {
    const t = convexTest(schema, convexModules);
    const d = await t.query(internal.bi.expenseGroups.expenseBreakdown, {});
    expect(d.totalCRC).toBe(0);
    expect(d.grupos).toEqual([]);
    expect(d.sinClasificar).toEqual([]);
  });
});
