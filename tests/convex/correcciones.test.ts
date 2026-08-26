/**
 * Correcciones autorizadas por Esteban el 24-ago-2026 (B37).
 *
 * Esto escribe sobre la contabilidad real de un cliente, así que lo que hay que
 * proteger no es que funcione: es que **no haga de más**.
 *
 *  1. Que `dryRun` sea el default. Olvidar el flag no puede escribir.
 *  2. Que sean idempotentes. Correr dos veces no puede aplicar dos veces.
 *  3. Que toquen **solo** lo autorizado: marzo eligió el aporte patronal y nada
 *     más; el refechado no puede mover una revisión real que caiga ese día.
 *  4. Que devuelvan el antes y el después de cada fila — es el respaldo.
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

const ms = (iso: string) => Date.parse(`${iso}T00:00:00-06:00`);

function fila(over: Record<string, unknown> = {}) {
  const t = ms("2026-03-31");
  return {
    kind: "expense" as const,
    category: "otros",
    isViatico: false,
    amountCRC: 10_000,
    originalCurrency: "CRC" as const,
    date: t,
    yearMonth: "2026-03",
    source: "sheet" as const,
    isDeleted: false,
    createdAt: t,
    updatedAt: t,
    ...over,
  };
}

const sembrar = async (filas: Array<Record<string, unknown>>) => {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    for (const f of filas) await ctx.db.insert("finance_entries", fila(f) as never);
  });
  return t;
};

const leer = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => ctx.db.query("finance_entries").collect());

/* ========================================================================== */
/* 1 · Marzo                                                                  */
/* ========================================================================== */

const MARZO = {
  externalKey: "sheet:MARZO 2026:APORTE PATRONO CCSS:1",
  category: "salario",
  amountCRC: 135_760,
};

describe("marzo · el aporte patronal", () => {
  test("por defecto NO escribe: dryRun es el default", async () => {
    // Si el default fuera aplicar, un `run` sin argumentos tocaría producción.
    const t = await sembrar([MARZO]);
    const res = await t.mutation(internal.bi.correcciones.corregirAportePatronalMarzo, {});

    expect(res.dryRun).toBe(true);
    expect(res.cambios).toHaveLength(1);
    expect((await leer(t))[0].amountCRC).toBe(135_760); // intacto
  });

  test("aplicado, deja ₡115.756 y reporta el delta", async () => {
    const t = await sembrar([MARZO]);
    const res = await t.mutation(internal.bi.correcciones.corregirAportePatronalMarzo, {
      dryRun: false,
    });

    expect(res.deltaCRC).toBe(-20_004);
    expect((await leer(t))[0].amountCRC).toBe(115_756);
  });

  test("correrla dos veces no vuelve a cambiar nada", async () => {
    const t = await sembrar([MARZO]);
    await t.mutation(internal.bi.correcciones.corregirAportePatronalMarzo, { dryRun: false });
    const otra = await t.mutation(internal.bi.correcciones.corregirAportePatronalMarzo, {
      dryRun: false,
    });

    expect(otra.yaEstaba).toBe(true);
    expect(otra.cambios).toEqual([]);
    expect((await leer(t))[0].amountCRC).toBe(115_756);
  });

  test("si el monto no es ninguno de los dos conocidos, se planta", async () => {
    // Alguien lo tocó por otra vía. Pisarlo a ciegas borraría esa intención.
    const t = await sembrar([{ ...MARZO, amountCRC: 99_999 }]);
    await expect(
      t.mutation(internal.bi.correcciones.corregirAportePatronalMarzo, { dryRun: false }),
    ).rejects.toThrow(/no se toca a ciegas/i);
  });

  test("NO toca las otras rarezas de marzo — solo se autorizó el aporte", async () => {
    // Marzo tiene además provisión de despido y vacaciones redondas. Rehacer el
    // mes era la opción (b) y Esteban eligió la (a).
    const t = await sembrar([
      MARZO,
      { externalKey: "sheet:MARZO 2026:PROVISION DESPIDO:1", category: "salario", amountCRC: 100_000 },
      { externalKey: "sheet:MARZO 2026:PROVISION VACACIONES:1", category: "salario", amountCRC: 20_000 },
    ]);
    await t.mutation(internal.bi.correcciones.corregirAportePatronalMarzo, { dryRun: false });

    const filas = await leer(t);
    const porLlave = new Map(filas.map((f) => [f.externalKey, f.amountCRC]));
    expect(porLlave.get("sheet:MARZO 2026:PROVISION DESPIDO:1")).toBe(100_000);
    expect(porLlave.get("sheet:MARZO 2026:PROVISION VACACIONES:1")).toBe(20_000);
  });
});

/* ========================================================================== */
/* 2 · Viáticos → gasolina                                                    */
/* ========================================================================== */

describe("los viáticos pasan a gasolina", () => {
  const VIATICOS = [
    { externalKey: "sheet:JULIO 2026:VIATICOS TECNICO:1", amountCRC: 26_000, isViatico: true },
    { externalKey: "sheet:AGOSTO:VIATICOS DEL 4 AL 9:1", amountCRC: 9_600, isViatico: true },
  ];

  test("mueve los que se llaman viáticos y suma el total", async () => {
    const t = await sembrar(VIATICOS);
    const res = await t.mutation(internal.bi.correcciones.moverViaticosAGasolina, {
      dryRun: false,
    });

    expect(res.cambios).toHaveLength(2);
    expect(res.totalCRC).toBe(35_600);
    for (const f of await leer(t)) expect(f.category).toBe("gasolina");
  });

  test("el flag de viático NO cambia — `gasolina` también es viático (B22)", async () => {
    const t = await sembrar(VIATICOS);
    await t.mutation(internal.bi.correcciones.moverViaticosAGasolina, { dryRun: false });
    for (const f of await leer(t)) expect(f.isViatico).toBe(true);
  });

  test("selecciona por ETIQUETA, no por el flag", async () => {
    // El flag lo lleva cualquier gasto variable de `otros`. Seleccionar por él
    // arrastraría a la gasolina cosas que no son viáticos.
    const t = await sembrar([
      ...VIATICOS,
      { externalKey: "sheet:JULIO 2026:EQUIPO:1", amountCRC: 50_000, isViatico: true },
    ]);
    const res = await t.mutation(internal.bi.correcciones.moverViaticosAGasolina, {
      dryRun: false,
    });

    expect(res.cambios).toHaveLength(2);
    expect(res.omitidasPorEtiqueta).toBe(1);
    const equipo = (await leer(t)).find((f) => f.externalKey?.includes("EQUIPO"));
    expect(equipo!.category).toBe("otros");
  });

  test("no toca lo que ya está en gasolina ni lo dado de baja", async () => {
    const t = await sembrar([
      { externalKey: "sheet:AGOSTO 2026:VIATICOS GAM:1", amountCRC: 28_000, category: "gasolina" },
      { externalKey: "sheet:JULIO 2026:VIATICOS TECNICO:9", amountCRC: 1_000, isDeleted: true },
    ]);
    const res = await t.mutation(internal.bi.correcciones.moverViaticosAGasolina, {
      dryRun: false,
    });
    expect(res.cambios).toEqual([]);
  });

  test("es idempotente", async () => {
    const t = await sembrar(VIATICOS);
    await t.mutation(internal.bi.correcciones.moverViaticosAGasolina, { dryRun: false });
    const otra = await t.mutation(internal.bi.correcciones.moverViaticosAGasolina, {
      dryRun: false,
    });
    expect(otra.cambios).toEqual([]);
  });

  test("por defecto tampoco escribe", async () => {
    const t = await sembrar(VIATICOS);
    await t.mutation(internal.bi.correcciones.moverViaticosAGasolina, {});
    for (const f of await leer(t)) expect(f.category).toBe("otros");
  });
});

/* ========================================================================== */
/* 3 · Refechar los fijos de agosto                                           */
/* ========================================================================== */

describe("los fijos de agosto pasan del 30 al 31", () => {
  const enAgosto = (over: Record<string, unknown> = {}) => ({
    yearMonth: "2026-08",
    date: ms("2026-08-30"),
    ...over,
  });

  test("mueve los gastos fijos de ese día", async () => {
    const t = await sembrar([
      enAgosto({ note: "SALARIO BRUTO TECNICO", category: "salario", amountCRC: 430_000 }),
      enAgosto({ note: "CONTADOR", amountCRC: 46_000 }),
    ]);
    const res = await t.mutation(internal.bi.correcciones.refecharFijosAgosto, {
      dryRun: false,
    });

    expect(res.cambios).toHaveLength(2);
    for (const f of await leer(t)) expect(f.date).toBe(ms("2026-08-31"));
  });

  test("NO mueve nada que haya generado el sistema desde una revisión", async () => {
    // Es la mitad importante. Y el caso que de verdad discrimina NO es el
    // ingreso —a ese ya lo frena `kind !== "expense"`— sino la **comisión**:
    // un GASTO con `source: "inspection"` que F5-auto deriva de la revisión.
    // Si se moviera, quedaría en otra fecha que la revisión que la originó.
    const t = await sembrar([
      enAgosto({ note: "CONTADOR", amountCRC: 46_000 }),
      enAgosto({ kind: "income", category: "inspeccion", source: "inspection", amountCRC: 64_000 }),
      enAgosto({ category: "comision", source: "inspection", amountCRC: 5_000 }),
    ]);
    const res = await t.mutation(internal.bi.correcciones.refecharFijosAgosto, {
      dryRun: false,
    });

    expect(res.cambios).toHaveLength(1);
    expect(res.omitidas).toBe(2);
    for (const f of (await leer(t)).filter((x) => x.source === "inspection")) {
      expect(f.date, f.category).toBe(ms("2026-08-30"));
    }
  });

  test("no toca otros días de agosto", async () => {
    const t = await sembrar([
      enAgosto({ note: "GASOLINA", date: ms("2026-08-12"), category: "gasolina" }),
    ]);
    const res = await t.mutation(internal.bi.correcciones.refecharFijosAgosto, {
      dryRun: false,
    });
    expect(res.cambios).toEqual([]);
    expect((await leer(t))[0].date).toBe(ms("2026-08-12"));
  });

  test("es idempotente y por defecto no escribe", async () => {
    const t = await sembrar([enAgosto({ note: "CONTADOR", amountCRC: 46_000 })]);
    await t.mutation(internal.bi.correcciones.refecharFijosAgosto, {});
    expect((await leer(t))[0].date).toBe(ms("2026-08-30")); // dryRun

    await t.mutation(internal.bi.correcciones.refecharFijosAgosto, { dryRun: false });
    const otra = await t.mutation(internal.bi.correcciones.refecharFijosAgosto, {
      dryRun: false,
    });
    expect(otra.cambios).toEqual([]);
  });
});

/* ========================================================================== */
/* El respaldo                                                                */
/* ========================================================================== */

describe("las tres devuelven el antes y el después", () => {
  test("cada cambio dice qué fila, qué había y qué queda", async () => {
    // Es el respaldo: sin esto no hay forma de revertir a mano.
    const t = await sembrar([
      MARZO,
      { externalKey: "sheet:JULIO 2026:VIATICOS TECNICO:1", amountCRC: 26_000, isViatico: true },
      { note: "CONTADOR", yearMonth: "2026-08", date: ms("2026-08-30"), amountCRC: 46_000 },
    ]);

    for (const [nombre, fn] of [
      ["marzo", internal.bi.correcciones.corregirAportePatronalMarzo],
      ["viáticos", internal.bi.correcciones.moverViaticosAGasolina],
      ["agosto", internal.bi.correcciones.refecharFijosAgosto],
    ] as const) {
      const res = await t.mutation(fn, {});
      expect(res.cambios.length, nombre).toBeGreaterThan(0);
      for (const c of res.cambios) {
        expect(c.id.length).toBeGreaterThan(0);
        expect(c.antes).not.toBe(c.despues);
        expect(Number.isFinite(c.amountCRC)).toBe(true);
      }
    }
  });
});
