/**
 * La vista unificada de revisiones y lo que cuelga de ella (A30 · A31 · A32 · A34).
 *
 * **Este archivo existía como hueco.** `metrics.ts` son 50 KB sin pruebas
 * propias: su única cobertura eran cuatro comprobaciones de que la versión
 * interna y la pública devuelven lo mismo — que verifican que dos caminos
 * coincidan, no que el número sea correcto. Y de acá sale el conteo de
 * revisiones sobre el que descansan el resumen ejecutivo, la conciliación y los
 * ingresos por canal.
 *
 * Lo que se fija, en orden de cuánto duele equivocarlo:
 *
 *  1. **El dedupe de solapes.** Mayo a julio de 2026 las revisiones existían en
 *     las dos plataformas a la vez. Contar doble infla el total y, con él, todo
 *     lo demás; contar de menos borra revisiones reales.
 *  2. **La exclusión de basura.** Filas de prueba con nombre «Test», teléfono
 *     55555555 o monto ₡0. Son de verdad y estaban en la fuente.
 *  3. **Los ₡1.000 de relleno**, que son una revisión hecha pero no un ingreso.
 *  4. **La normalización**, que decide si «Publicidad» y «Mercadeo» son un canal
 *     o dos, y si «Grecia» es una provincia o una agencia.
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

const dia = (iso: string) => Date.parse(`${iso}T10:00:00-06:00`);
const MS_DIA = 24 * 3600 * 1000;

/** Revisión de la app (era-app). Es la autoritativa en los solapes. */
function app(over: Record<string, unknown> = {}) {
  return {
    clientName: "Ana León",
    clientPhone: "8888-7777",
    vehicleBrand: "Toyota",
    totalAmountCharged: 60_000,
    inspectionStartAt: dia("2026-07-10"),
    // `inspections` usa uniones cerradas en snake_case; `inspections_legacy` es
    // texto libre. Esa asimetría es justamente lo que la normalización resuelve.
    province: "san_jose",
    engineType: "gasolina",
    captureSource: "mercadeo",
    ...over,
  };
}

/**
 * Revisión del CRM anterior (legacy). Texto libre, como venía del CRM.
 *
 * **El nombre por defecto es distinto al de `app()` a propósito.** Con el mismo
 * nombre, la misma fecha y la misma marca, el dedupe débil las funde — que es lo
 * correcto, pero convierte cualquier escenario descuidado en un solape
 * accidental. Las pruebas que SÍ quieren probar la fusión ponen el nombre igual
 * de forma explícita.
 */
function legacy(over: Record<string, unknown> = {}) {
  return {
    sourceRowId: `row-${Math.round(Math.random() * 1e9)}`,
    clientName: "Bruno Mora",
    phone8: "88887777",
    vehicleBrand: "Toyota",
    amountCRC: 60_000,
    inspectionDate: dia("2026-07-10"),
    province: "San José",
    engineType: "Gasolina",
    channel: "Publicidad",
    originalCurrency: "CRC" as const,
    ...over,
  };
}

async function conRevisiones(
  apps: Array<Record<string, unknown>> = [],
  legacies: Array<Record<string, unknown>> = [],
) {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    for (const a of apps) await ctx.db.insert("inspections", app(a) as never);
    let n = 0;
    for (const l of legacies)
      await ctx.db.insert(
        "inspections_legacy",
        { ...legacy(l), sourceRowId: `row-${n++}` } as never,
      );
  });
  return t;
}

const vista = (t: ReturnType<typeof convexTest>) =>
  t.query(internal.bi.metrics.inspectionsAll, { sampleSize: 50 });

/* ========================================================================== */
/* 1 · Dedupe de solapes (A30)                                                */
/* ========================================================================== */

describe("una revisión que está en las dos plataformas cuenta UNA vez", () => {
  test("mismo teléfono: gana la de la app", async () => {
    // Mayo–julio de 2026 convivieron las dos fuentes. Es el solape real.
    const t = await conRevisiones([{}], [{}]);
    const res = await vista(t);

    expect(res.counts.unifiedTotal).toBe(1);
    expect(res.counts.dupSuperseded).toBe(1);
    expect(res.sample[0].source).toBe("era_app");
  });

  test("sin teléfono: nombre igual + dentro de 7 días + misma marca", async () => {
    const t = await conRevisiones(
      [{ clientPhone: undefined }],
      [{ phone8: undefined, clientName: "Ana León", inspectionDate: dia("2026-07-13") }],
    );
    expect((await vista(t)).counts.unifiedTotal).toBe(1);
  });

  test("el mismo nombre a MÁS de 7 días son dos revisiones distintas", async () => {
    // Un cliente que vuelve dos meses después no es un duplicado: es recompra,
    // y fusionarla le borraría una revisión real del conteo.
    const t = await conRevisiones(
      [{ clientPhone: undefined }],
      [{ phone8: undefined, clientName: "Ana León", inspectionDate: dia("2026-07-10") + 8 * MS_DIA }],
    );
    expect((await vista(t)).counts.unifiedTotal).toBe(2);
  });

  test("mismo nombre y fecha pero OTRA marca no se fusiona", async () => {
    const t = await conRevisiones(
      [{ clientPhone: undefined, vehicleBrand: "Toyota" }],
      [{ phone8: undefined, clientName: "Ana León", vehicleBrand: "Hyundai" }],
    );
    expect((await vista(t)).counts.unifiedTotal).toBe(2);
  });

  test("una legacy solo puede absorber a UNA de la app", async () => {
    // Dos revisiones distintas de la app con el mismo teléfono —el cliente
    // volvió— contra una sola legacy: no pueden colapsar las tres en una.
    const t = await conRevisiones(
      [{}, { inspectionStartAt: dia("2026-07-11") }],
      [{}],
    );
    const res = await vista(t);
    expect(res.counts.dupSuperseded).toBe(1);
    expect(res.counts.unifiedTotal).toBe(2);
  });
});

/* ========================================================================== */
/* 2 · Basura                                                                 */
/* ========================================================================== */

describe("las filas de prueba no cuentan", () => {
  test("nombre «Test», teléfono 55555555 y monto ₡0 quedan fuera", async () => {
    const t = await conRevisiones([
      { clientName: "Test", clientPhone: "1111-1111" },
      { clientName: "Otro", clientPhone: "5555-5555" },
      { clientName: "Tercero", clientPhone: "2222-2222", totalAmountCharged: 0 },
      { clientName: "Real", clientPhone: "3333-3333" },
    ]);
    const res = await vista(t);

    expect(res.counts.unifiedTotal).toBe(1);
    expect(res.counts.junkExcluded).toBe(3);
  });

  test("una revisión SIN monto sí cuenta — no es lo mismo que ₡0", async () => {
    // Sin monto es «no se anotó»; ₡0 es una fila de prueba. Confundirlos
    // borraría revisiones reales a las que solo les falta el cobro.
    const t = await conRevisiones([
      { clientPhone: "4444-4444", totalAmountCharged: undefined },
    ]);
    const res = await vista(t);
    expect(res.counts.unifiedTotal).toBe(1);
    expect(res.withAmount).toBe(0);
  });
});

/* ========================================================================== */
/* 3 · Los ₡1.000 de relleno                                                  */
/* ========================================================================== */

describe("los montos de ₡1.000", () => {
  test("cuentan como revisión pero NO como ingreso", async () => {
    const t = await conRevisiones([
      { clientPhone: "4444-4444", totalAmountCharged: 1_000 },
      { clientPhone: "5555-4444", totalAmountCharged: 60_000 },
    ]);
    const res = await vista(t);

    expect(res.counts.unifiedTotal).toBe(2);
    expect(res.counts.unifiedSinPlaceholder).toBe(1);
    expect(res.counts.placeholderRows).toBe(1);
    /**
     * **A157 — se resolvió una contradicción de tres puntas.** El docblock del
     * módulo decía «cuentan como revisión pero **NO aportan ingreso**», el
     * título de esta prueba decía lo mismo, y su assert decía lo contrario con
     * un comentario que lo defendía («es lo que se cobró, aunque sea
     * simbólico»). El código sumaba.
     *
     * Se resolvió a favor de lo documentado: un ₡1.000 del histórico **no es un
     * cobro de ₡1.000**, es una fila a la que nunca se le anotó el monto. Por
     * eso existe `unifiedSinPlaceholder`. Impacto hoy: **₡0** — en producción
     * `placeholderRows` es 0.
     */
    expect(res.totalAmountCRC).toBe(60_000);
  });
});

/* ========================================================================== */
/* 4 · Normalización (A31 · A32 · A34)                                        */
/* ========================================================================== */

describe("el canal se unifica a un solo vocabulario", () => {
  test("«Publicidad» del CRM y «mercadeo» de la app son el MISMO canal", async () => {
    // Si no, el tablero mostraría dos canales donde hay uno y ninguno de los
    // dos tendría el tamaño real.
    const t = await conRevisiones(
      [{ clientPhone: "1111-2222", captureSource: "mercadeo" }],
      [{ phone8: "33334444", channel: "Publicidad" }],
    );
    const res = await t.query(internal.bi.metrics.totalRevisiones, {});
    const canales = res.byChannel.map((c) => c.key);

    expect(canales).toEqual(["Mercadeo"]);
    expect(canales).not.toContain("Publicidad");
  });

  test("un canal desconocido cae en «Otro», no se pierde", async () => {
    // Solo puede venir del CRM viejo: `captureSource` de la app es una unión
    // cerrada, así que ahí no entra nada raro. El texto libre es el legacy.
    const t = await conRevisiones([], [{ channel: "boca a boca" }]);
    const res = await t.query(internal.bi.metrics.totalRevisiones, {});
    expect(res.byChannel.map((c) => c.key)).toEqual(["Otro"]);
  });

  test("sin canal se rotula, no desaparece del desglose", async () => {
    const t = await conRevisiones([{ clientPhone: "1111-2222", captureSource: undefined }]);
    const res = await t.query(internal.bi.metrics.totalRevisiones, {});
    expect(res.byChannel[0].key).toBe("(sin canal)");
    expect(res.byChannel[0].rows).toBe(1);
  });
});

describe("la ubicación distingue provincia de agencia (B26 · A32)", () => {
  test("una provincia real queda como provincia", async () => {
    const t = await conRevisiones([{ clientPhone: "1111-2222", province: "cartago" }]);
    const res = await t.query(internal.bi.metrics.totalRevisiones, {});
    expect(res.byProvince.map((p) => p.key)).toEqual(["Cartago"]);
    expect(res.agencyDistinct).toBe(0);
  });

  test("lo que no es provincia se trata como AGENCIA, no como basura", async () => {
    // Esteban usa ese campo también para anotar dónde se revisó el carro.
    // Tirarlo a «Desconocido» perdía el dato que él quería llevar.
    const t = await conRevisiones([
      { clientPhone: "1111-2222", province: undefined },
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("inspections_legacy", {
        ...legacy({ phone8: "99998888", province: "Autos Garaje 46" }),
        sourceRowId: "ag-1",
      } as never);
    });
    const res = await t.query(internal.bi.metrics.totalRevisiones, {});
    expect(res.agencyDistinct).toBe(1);
    // Y el nombre queda CANONICALIZADO: «Garaje» y «Garage» son la misma
    // agencia escrita de dos formas, y sin colapsarlas el conteo por agencia
    // —que es para lo que Esteban usa el campo— quedaría partido.
    expect(res.byAgency[0].key).toBe("Autos Garage 46");
  });

  test("las variantes de una misma agencia colapsan en una", async () => {
    const t = await conRevisiones(
      [],
      [
        { clientName: "A", phone8: "10000001", province: "Autos Garaje 46" },
        { clientName: "B", phone8: "10000002", province: "AUTOS GARAGE 46" },
        { clientName: "C", phone8: "10000003", province: "autos garaje46" },
      ],
    );
    const res = await t.query(internal.bi.metrics.totalRevisiones, {});
    expect(res.agencyDistinct).toBe(1);
    expect(res.byAgency[0].rows).toBe(3);
  });
});

/* ========================================================================== */
/* 5 · Los desgloses suman el total                                           */
/* ========================================================================== */

describe("ningún desglose pierde ni inventa revisiones", () => {
  test("mes, provincia, motor, canal y fuente suman lo mismo", async () => {
    const t = await conRevisiones(
      [
        { clientPhone: "1111-1112", inspectionStartAt: dia("2026-06-10") },
        { clientPhone: "1111-1113", engineType: undefined },
        { clientPhone: "1111-1114", captureSource: "tiktok" },
      ],
      [{ phone8: "22221111", province: "Alajuela" }],
    );
    const res = await t.query(internal.bi.metrics.totalRevisiones, {});
    const suma = (g: Array<{ rows: number }>) => g.reduce((a, x) => a + x.rows, 0);

    for (const [nombre, grupo] of [
      ["byMonth", res.byMonth],
      ["byProvince", res.byProvince],
      ["byEngineType", res.byEngineType],
      ["byChannel", res.byChannel],
      ["bySource", res.bySource],
    ] as const) {
      expect(suma(grupo), nombre).toBe(res.total);
    }
  });
});

/* ========================================================================== */
/* 6 · Filtros                                                                */
/* ========================================================================== */

describe("los filtros", () => {
  test("el periodo es semiabierto en el borde exacto", async () => {
    // Las legacy vienen de fechas sin hora, así que caen justo a medianoche.
    const corte = Date.parse("2026-07-01T00:00:00-06:00");
    const t = await conRevisiones([
      { clientPhone: "1111-1112", inspectionStartAt: corte - 1 },
      { clientPhone: "1111-1113", inspectionStartAt: corte },
    ]);
    const antes = await t.query(internal.bi.metrics.inspectionsAll, { toMs: corte });
    const desde = await t.query(internal.bi.metrics.inspectionsAll, { fromMs: corte });

    expect(antes.counts.unifiedTotal).toBe(1);
    expect(desde.counts.unifiedTotal).toBe(1);
  });

  test("filtrar por canal usa el vocabulario ya unificado", async () => {
    const t = await conRevisiones(
      [{ clientPhone: "1111-1112", captureSource: "mercadeo" }],
      [{ phone8: "33221100", channel: "TikTok" }],
    );
    const res = await t.query(internal.bi.metrics.inspectionsAll, {
      channel: "Mercadeo",
    });
    expect(res.counts.unifiedTotal).toBe(1);
    expect(res.counts.unifiedTotalNoFilter).toBe(2);
  });

  /* ---- las cuatro dimensiones que agregó RF-02 ---- */

  test("filtrar por MARCA cruza las dos fuentes pese al texto libre del CRM", async () => {
    // La app guarda «Hyundai» y el CRM «Hyundai Tucson 2017». Si el filtro
    // comparara el texto crudo, elegir Hyundai devolvería una sola.
    const t = await conRevisiones(
      [{ clientPhone: "1111-1112", vehicleBrand: "Hyundai" }],
      [
        { phone8: "33221100", clientName: "Otro Uno", vehicleBrand: "Hyundai Tucson 2017" },
        { phone8: "33221101", clientName: "Otro Dos", vehicleBrand: "Toyota Rav4" },
      ],
    );
    const res = await t.query(internal.bi.metrics.inspectionsAll, {
      brand: "Hyundai",
    });

    expect(res.counts.unifiedTotalNoFilter).toBe(3);
    expect(res.counts.unifiedTotal).toBe(2);
  });

  test("canonicalizar la marca NO fusiona revisiones que antes contaban aparte", async () => {
    // **La regresión que hay que evitar.** El dedupe débil compara nombre +
    // fecha + vehículo. Si usara la marca canónica, «Hyundai» de la app y
    // «Hyundai Tucson 2017» del CRM pasarían a ser iguales y estas dos filas
    // se fundirían en una: las 887 revisiones de producción se moverían solas.
    // Por eso el dedupe sigue usando el texto crudo y la marca canónica vive
    // en un campo aparte.
    const mismaFecha = dia("2026-07-10");
    const t = await conRevisiones(
      [
        {
          clientName: "Ana León",
          clientPhone: undefined,
          vehicleBrand: "Hyundai",
          inspectionStartAt: mismaFecha,
        },
      ],
      [
        {
          clientName: "Ana León",
          phone8: undefined,
          vehicleBrand: "Hyundai Tucson 2017",
          inspectionDate: mismaFecha,
        },
      ],
    );
    const res = await t.query(internal.bi.metrics.inspectionsAll, {});

    expect(res.counts.unifiedTotal).toBe(2);
    expect(res.counts.dupSuperseded).toBe(0);
  });

  test("filtrar por TIPO DE VENDEDOR deja fuera las del CRM, que no lo traen", async () => {
    // El caso que discrimina. Si una fila sin dato pasara el filtro, elegir
    // «particular» devolvería también las legacy —que no dicen nada al
    // respecto— y el resultado sería mayor que las revisiones que tienen el
    // dato. La pantalla avisa de esta pérdida; el backend no la disimula.
    const t = await conRevisiones(
      [
        { clientPhone: "1111-1112", sellerType: "particular" },
        { clientPhone: "1111-1113", sellerType: "concesionaria" },
      ],
      [{ phone8: "33221100", clientName: "Sin Vendedor" }],
    );
    const res = await t.query(internal.bi.metrics.inspectionsAll, {
      sellerType: "particular",
    });

    expect(res.counts.unifiedTotalNoFilter).toBe(3);
    expect(res.counts.unifiedTotal).toBe(1);
  });

  test("filtrar por MONEDA separa lo cobrado en dólares", async () => {
    // La app cobra siempre en colones; el CRM tiene las dos.
    const t = await conRevisiones(
      [{ clientPhone: "1111-1112" }],
      [
        { phone8: "33221100", clientName: "Uno", originalCurrency: "USD" },
        { phone8: "33221101", clientName: "Dos", originalCurrency: "CRC" },
      ],
    );
    const usd = await t.query(internal.bi.metrics.inspectionsAll, { currency: "USD" });
    const crc = await t.query(internal.bi.metrics.inspectionsAll, { currency: "CRC" });

    expect(usd.counts.unifiedTotal).toBe(1);
    expect(crc.counts.unifiedTotal).toBe(2); // la de la app entra acá
  });

  test("filtrar por LOCALIDAD usa la agencia canonicalizada", async () => {
    const t = await conRevisiones(
      [],
      [
        { phone8: "33221100", clientName: "Uno", province: "VEINSA Curridabat usados" },
        { phone8: "33221101", clientName: "Dos", province: "Heredia" },
      ],
    );
    // La agencia canónica la decide el backend (A32/B26: «Garaje»→«Garage»),
    // así que se toma de su propio desglose en vez de escribirla a mano.
    const res = await t.query(internal.bi.metrics.totalRevisiones, {});
    const agencia = res.byAgency[0]?.key;
    expect(agencia).toBeTruthy();

    const filtrado = await t.query(internal.bi.metrics.totalRevisiones, {
      agency: agencia,
    });
    expect(filtrado.total).toBe(1);
  });
});

/* ========================================================================== */
/* 7 · Finanzas y resumen ejecutivo                                           */
/* ========================================================================== */

describe("el resumen ejecutivo", () => {
  const gasto = (over: Record<string, unknown> = {}) => ({
    kind: "expense" as const,
    category: "otros",
    isViatico: false,
    amountCRC: 100_000,
    originalCurrency: "CRC" as const,
    date: dia("2026-07-15"),
    yearMonth: "2026-07",
    source: "sheet" as const,
    isDeleted: false,
    createdAt: dia("2026-07-15"),
    updatedAt: dia("2026-07-15"),
    ...over,
  });

  test("los ingresos titulares salen de FINANZAS, no de las revisiones (A16)", async () => {
    // Son dos cuentas distintas y las dos son correctas. Si el resumen tomara
    // el monto de las revisiones, el número no cuadraría con el P&L de Esteban.
    const t = await conRevisiones([{ clientPhone: "1111-1112", totalAmountCharged: 60_000 }]);
    await t.run(async (ctx) => {
      await ctx.db.insert("finance_entries", gasto({ kind: "income", amountCRC: 500_000 }) as never);
      await ctx.db.insert("finance_entries", gasto({ amountCRC: 200_000 }) as never);
    });
    const res = await t.query(internal.bi.metrics.executiveSummary, {});

    expect(res.ingresosFinancierosCRC).toBe(500_000);
    expect(res.ingresosInspeccionesCRC).toBe(60_000); // distinto, y a propósito
    expect(res.utilidadCRC).toBe(300_000);
    expect(res.totalRevisiones).toBe(1);
  });

  test("un movimiento dado de baja no cuenta", async () => {
    const t = await conRevisiones([]);
    await t.run(async (ctx) => {
      await ctx.db.insert("finance_entries", gasto({ kind: "income", amountCRC: 500_000 }) as never);
      await ctx.db.insert(
        "finance_entries",
        gasto({ kind: "income", amountCRC: 999_000, isDeleted: true }) as never,
      );
    });
    const res = await t.query(internal.bi.metrics.executiveSummary, {});
    expect(res.ingresosFinancierosCRC).toBe(500_000);
  });

  test("sin datos devuelve ceros y no NaN en los porcentajes", async () => {
    const t = await conRevisiones([]);
    const res = await t.query(internal.bi.metrics.executiveSummary, {});
    expect(res.totalRevisiones).toBe(0);
    expect(Number.isFinite(res.marginPct)).toBe(true);
    expect(Number.isFinite(res.conversionPct)).toBe(true);
  });
});

describe("la conciliación", () => {
  test("el mes EN CURSO se rotula y no se marca como anomalía (A59)", async () => {
    // La revisión se cuenta cuando se hace y el ingreso cuando se entrega el
    // informe, así que el mes vivo siempre muestra diferencia. Marcarlo como
    // problema haría saltar la alarma todos los meses.
    const ahora = Date.now();
    const t = await conRevisiones([
      { clientPhone: "1111-1112", inspectionStartAt: ahora, totalAmountCharged: 500_000 },
    ]);
    const res = await t.query(internal.bi.metrics.reconciliation, {});
    const enCurso = res.months.filter((m) => m.enCurso);

    expect(enCurso).toHaveLength(1);
    expect(enCurso[0].significant).toBe(false);
  });

  /**
   * Qué mes se capturó solo y cuál a mano.
   *
   * Es la marca que hace legible al tablero: **el gap de un mes capturado a
   * mano y el de uno capturado solo no significan lo mismo**, y sin distinguirlos
   * la tabla invita a compararlos como si fueran el mismo indicador.
   */
  const ingreso = (over: Record<string, unknown> = {}) => ({
    kind: "income" as const,
    category: "revision",
    isViatico: false,
    amountCRC: 100_000,
    originalCurrency: "CRC" as const,
    date: dia("2026-02-10"),
    yearMonth: "2026-02",
    source: "sheet" as const,
    isDeleted: false,
    createdAt: dia("2026-02-10"),
    updatedAt: dia("2026-02-10"),
    ...over,
  });

  const mes = (res: { months: { yearMonth: string; autoCaptura: boolean }[] }, ym: string) =>
    res.months.find((m) => m.yearMonth === ym);

  test("un mes con ingreso de la hoja NO se marca como capturado solo", async () => {
    const t = await conRevisiones([]);
    await t.run(async (ctx) => {
      await ctx.db.insert("finance_entries", ingreso() as never);
    });
    const res = await t.query(internal.bi.metrics.reconciliation, {});

    expect(mes(res, "2026-02")?.autoCaptura).toBe(false);
    expect(res.primerMesAutoCaptura).toBeNull();
  });

  test("basta UN ingreso del sistema para marcar el mes, aunque los demás sean a mano", async () => {
    // El corte de F5-auto fue por fecha de entrega y sin backfill (B27.1), así
    // que el mes del cambio viene mezclado. Con un umbral de mayoría ese mes
    // quedaría rotulado como manual y se borraría justo la frontera que el
    // tablero existe para mostrar.
    const t = await conRevisiones([]);
    await t.run(async (ctx) => {
      await ctx.db.insert("finance_entries", ingreso({ source: "inspection" }) as never);
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("finance_entries", ingreso() as never);
      }
    });
    const res = await t.query(internal.bi.metrics.reconciliation, {});

    expect(mes(res, "2026-02")?.autoCaptura).toBe(true);
  });

  test("una COMISIÓN del sistema no marca el mes: es un gasto, no un ingreso", async () => {
    // El caso que discrimina, y es el mismo de A97: `source: "inspection"`
    // también lo llevan las comisiones, que son *gastos*. Marcar el mes por
    // ellas diría que un mes se capturó solo cuando su ingreso sigue siendo
    // todo manual. Una prueba con un ingreso normal no distingue nada acá.
    const t = await conRevisiones([]);
    await t.run(async (ctx) => {
      await ctx.db.insert("finance_entries", ingreso() as never);
      await ctx.db.insert(
        "finance_entries",
        ingreso({ kind: "expense", category: "otros", source: "inspection" }) as never,
      );
    });
    const res = await t.query(internal.bi.metrics.reconciliation, {});

    expect(mes(res, "2026-02")?.autoCaptura).toBe(false);
    expect(res.primerMesAutoCaptura).toBeNull();
  });

  test("`primerMesAutoCaptura` es el mes MÁS VIEJO, no el último ni el primero que se encuentre", async () => {
    // Se insertan al revés a propósito: si la búsqueda tomara el orden de
    // inserción en vez del orden cronológico, esto devolvería mayo.
    const t = await conRevisiones([]);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "finance_entries",
        ingreso({ source: "inspection", date: dia("2026-05-10"), yearMonth: "2026-05" }) as never,
      );
      await ctx.db.insert(
        "finance_entries",
        ingreso({ source: "inspection", date: dia("2026-03-10"), yearMonth: "2026-03" }) as never,
      );
    });
    const res = await t.query(internal.bi.metrics.reconciliation, {});

    expect(res.primerMesAutoCaptura).toBe("2026-03");
    expect(mes(res, "2026-03")?.autoCaptura).toBe(true);
    expect(mes(res, "2026-05")?.autoCaptura).toBe(true);
  });

  test("un ingreso del sistema dado de baja no marca el mes", async () => {
    const t = await conRevisiones([]);
    await t.run(async (ctx) => {
      await ctx.db.insert("finance_entries", ingreso() as never);
      await ctx.db.insert(
        "finance_entries",
        ingreso({ source: "inspection", isDeleted: true }) as never,
      );
    });
    const res = await t.query(internal.bi.metrics.reconciliation, {});

    expect(mes(res, "2026-02")?.autoCaptura).toBe(false);
  });
});

describe("los textos que el BI guarda para mostrar", () => {
  test("el aviso de conciliación trae los montos con separador de miles", async () => {
    // Este `detail` se pinta tal cual en el tablero de Calidad. Sin separador,
    // «₡4546000» obliga a contar dígitos para saber si son cuatro millones o
    // cuarenta y cinco — y en un aviso que pide acción, eso es el dato.
    const t = await conRevisiones([
      { clientPhone: "1111-1112", inspectionStartAt: dia("2025-09-10"), totalAmountCharged: 1_000_000 },
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("finance_entries", {
        kind: "income",
        category: "revision",
        isViatico: false,
        amountCRC: 4_546_000,
        originalCurrency: "CRC",
        date: dia("2025-09-10"),
        yearMonth: "2025-09",
        source: "sheet",
        isDeleted: false,
        createdAt: dia("2025-09-10"),
        updatedAt: dia("2025-09-10"),
      } as never);
    });
    await t.mutation(internal.bi.metrics.flagReconciliationGap, {});

    const issues = await t.run(async (ctx) =>
      (await ctx.db.query("bi_quality_issues").collect()).filter(
        (i) => i.issueType === "reconciliation_gap",
      ),
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].detail).toContain("₡4.546.000");
    expect(issues[0].detail).not.toContain("₡4546000");
  });
});

/* ========================================================================== */
/* La portada y Leads tienen que decir el MISMO número (A125)                  */
/* ========================================================================== */

describe("la conversión de la portada coincide con la de Leads", () => {
  /**
   * **Esta prueba nació de un defecto que ninguna otra vio.**
   *
   * Cuando A112 separó las recompras, la regla se aplicó en el embudo y en la
   * lista de convertidos, pero `executiveSummary` tenía **su propio bucle** y se
   * quedó afuera: la portada decía **236** y Leads **220**. Dos pantallas del
   * mismo tablero con 16 de diferencia — el tipo de cosa que, cuando el cliente
   * la encuentra, hace desconfiar de todo lo demás. La halló la pasada de
   * validaciones del 2-set, no una prueba.
   *
   * Lo que se fija no es el número: es que **los dos caminos den lo mismo**. Si
   * mañana cambia la definición de conversión, esta prueba obliga a cambiarla en
   * los dos lados o a cara descubierta.
   */
  async function conRecompra() {
    const t = convexTest(schema, convexModules);
    const dia = (iso: string) => Date.parse(`${iso}T10:00:00-06:00`);
    await t.run(async (ctx) => {
      // Un lead de julio con una revisión de enero: es recompra, no conversión.
      const leadId = await ctx.db.insert("leads_contacts", {
        dedupKey: "88887777", phone8: "88887777", phoneValid: true,
        name: "Ana León", vehicleBrand: "Toyota", leadStage: "nuevo",
        source: "airtable_migration", sourceCreatedAt: dia("2026-07-01"),
        isDeleted: false, createdAt: 0, updatedAt: 0,
      } as never);
      // Y otro que sí convirtió después de escribir.
      const leadId2 = await ctx.db.insert("leads_contacts", {
        dedupKey: "70001111", phone8: "70001111", phoneValid: true,
        name: "Carlos Mora", vehicleBrand: "Hyundai", leadStage: "nuevo",
        source: "airtable_migration", sourceCreatedAt: dia("2026-07-01"),
        isDeleted: false, createdAt: 0, updatedAt: 0,
      } as never);
      for (const [leadRef, fecha] of [
        [leadId, dia("2026-01-15")], // anterior al lead → recompra
        [leadId2, dia("2026-07-10")], // posterior → conversión
      ] as const) {
        await ctx.db.insert("bi_matches", {
          leadId: leadRef, matchTarget: "era_app", matchMethod: "phone_exact",
          matchKey: "phone:x", confidence: 1, confidenceBand: "alta",
          ambiguous: false, validIncome: true, inspectionDate: fecha,
          amountCRC: 60_000, computedAt: 0,
        } as never);
      }
    });
    return t;
  }

  test("las dos pantallas dan el mismo número de convertidos", async () => {
    const t = await conRecompra();
    const portada = await t.query(internal.bi.metrics.executiveSummary, {});
    const leads = await t.query(internal.bi.matches.conversionFunnel, {
      sampleSize: 0,
    });

    expect(portada.convertidos).toBe(leads.converted);
  });

  test("y la recompra queda fuera de las dos, no solo de una", async () => {
    const t = await conRecompra();
    const portada = await t.query(internal.bi.metrics.executiveSummary, {});
    const leads = await t.query(internal.bi.matches.conversionFunnel, {
      sampleSize: 0,
    });

    // Hay dos matches válidos de banda alta; uno es recompra.
    expect(leads.recompras).toBe(1);
    expect(leads.converted).toBe(1);
    expect(portada.convertidos).toBe(1);
  });
});
