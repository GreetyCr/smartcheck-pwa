/**
 * Ingresos por canal (F3).
 *
 * Lo que hay que proteger, en orden de qué duele más si falla:
 *
 *  1. **Que el ticket promedio no se calcule sobre la base equivocada.** Si se
 *     dividiera entre todas las revisiones en vez de las que tienen monto, un
 *     canal quedaría barato solo porque a alguna de sus filas no se le anotó el
 *     cobro — y el ticket es justo el número con el que se comparan canales.
 *  2. **Que el canal ausente no desaparezca.** Las revisiones sin canal existen
 *     y valen plata; si se cayeran del desglose, los porcentajes seguirían
 *     sumando 100% y nadie notaría el faltante (A64).
 *  3. **Que la pauta no se reparta sola.** En la hoja es una bolsa única; el
 *     costo se atribuye a Mercadeo a propósito y eso tiene que ser estable.
 *  4. **Que la suma de los canales sea exactamente el total.** Reagrupar no
 *     puede inventar ni perder un colón.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CANAL_CON_PAUTA, SIN_CANAL } from "../../convex/bi/channels";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const dia = (iso: string) => Date.parse(`${iso}T10:00:00-06:00`);

/** Una revisión legacy: es la vía más corta para fijar canal, fecha y monto. */
function legacy(over: Record<string, unknown> = {}) {
  return {
    sourceRowId: `row-${Math.round(Math.random() * 1e9)}`,
    inspectionDate: dia("2026-07-10"),
    clientName: "Cliente Prueba",
    channel: "Publicidad",
    province: "San José",
    engineType: "Gasolina",
    amountCRC: 60_000,
    originalCurrency: "CRC" as const,
    ...over,
  };
}

function pauta(over: Record<string, unknown> = {}) {
  const date = dia("2026-07-05");
  return {
    kind: "expense" as const,
    category: "publicidad",
    isViatico: false,
    amountCRC: 100_000,
    originalCurrency: "CRC" as const,
    date,
    yearMonth: "2026-07",
    source: "sheet" as const,
    isDeleted: false,
    createdAt: date,
    updatedAt: date,
    ...over,
  };
}

async function conFilas(
  revisiones: Array<Record<string, unknown>>,
  gastos: Array<Record<string, unknown>> = [],
) {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    let n = 0;
    for (const r of revisiones) {
      await ctx.db.insert("inspections_legacy", {
        ...legacy(r),
        sourceRowId: `row-${n++}`,
      } as never);
    }
    for (const g of gastos) await ctx.db.insert("finance_entries", pauta(g) as never);
  });
  return t;
}

const canal = (res: any, nombre: string) =>
  res.canales.find((c: any) => c.canal === nombre);

describe("el desglose por canal", () => {
  test("agrupa, suma y ordena por ingreso", async () => {
    const t = await conFilas([
      { channel: "Publicidad", amountCRC: 60_000 },
      { channel: "Publicidad", amountCRC: 40_000 },
      { channel: "Referido", amountCRC: 70_000 },
    ]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    // «Publicidad» se normaliza a «Mercadeo» (A34): el vocabulario viejo del CRM
    // no puede aparecer en pantalla como si fuera un canal aparte del nuevo.
    expect(res.canales.map((c: any) => c.canal)).toEqual(["Mercadeo", "Referido"]);
    expect(canal(res, "Mercadeo").ingresosCRC).toBe(100_000);
    expect(canal(res, "Referido").ingresosCRC).toBe(70_000);
  });

  test("la suma de los canales es EXACTAMENTE el total", async () => {
    const t = await conFilas([
      { channel: "Publicidad", amountCRC: 60_000 },
      { channel: "TikTok", amountCRC: 51_000 },
      { channel: "Recompra", amountCRC: 57_000 },
      { channel: undefined, amountCRC: 12_345 },
    ]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    const suma = res.canales.reduce((a: number, c: any) => a + c.ingresosCRC, 0);
    expect(suma).toBe(res.totalIngresosCRC);
    expect(res.canales.reduce((a: number, c: any) => a + c.rows, 0)).toBe(res.totalRows);
  });

  test("las revisiones SIN canal siguen visibles con su monto", async () => {
    // Si se cayeran, los porcentajes seguirían dando 100% y el faltante sería
    // invisible. El hueco tiene que ser ruidoso.
    const t = await conFilas([
      { channel: "Publicidad", amountCRC: 60_000 },
      { channel: undefined, amountCRC: 90_000 },
      { channel: "", amountCRC: 10_000 },
    ]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    const sin = canal(res, SIN_CANAL);
    expect(sin).toBeDefined();
    expect(sin.rows).toBe(2);
    expect(sin.ingresosCRC).toBe(100_000);
  });
});

describe("el ticket promedio", () => {
  test("se calcula sobre las revisiones CON monto, no sobre todas", async () => {
    // Dos revisiones, una sin cobro anotado. El ticket es 60.000, no 30.000.
    const t = await conFilas([
      { channel: "Publicidad", amountCRC: 60_000 },
      { channel: "Publicidad", amountCRC: undefined },
    ]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    const m = canal(res, CANAL_CON_PAUTA);
    expect(m.rows).toBe(2);
    expect(m.rowsConMonto).toBe(1);
    expect(m.ticketPromedioCRC).toBe(60_000);
  });

  test("un canal sin ningún monto da 0 y no NaN", async () => {
    const t = await conFilas([{ channel: "Buscador", amountCRC: undefined }]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    const b = canal(res, "Buscador");
    expect(b.ticketPromedioCRC).toBe(0);
    expect(Number.isFinite(b.ticketPromedioCRC)).toBe(true);
  });

  test("distingue dos canales con el mismo ingreso y distinto ticket", async () => {
    // Es la comparación que el tablero existe para permitir.
    const t = await conFilas([
      { channel: "Publicidad", amountCRC: 120_000 },
      { channel: "TikTok", amountCRC: 60_000 },
      { channel: "TikTok", amountCRC: 60_000 },
    ]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    expect(canal(res, CANAL_CON_PAUTA).ingresosCRC).toBe(
      canal(res, "TikTok").ingresosCRC,
    );
    expect(canal(res, CANAL_CON_PAUTA).ticketPromedioCRC).toBe(120_000);
    expect(canal(res, "TikTok").ticketPromedioCRC).toBe(60_000);
  });
});

describe("un canal que dejó de traer revisiones", () => {
  test("reporta cuántos meses lleva sin una sola", async () => {
    // Es la señal que dice «TikTok se apagó» sin tener que leer la serie.
    const t = await conFilas([
      { channel: "TikTok", inspectionDate: dia("2026-05-20"), amountCRC: 50_000 },
    ]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    const tk = canal(res, "TikTok");
    expect(tk.ultimaRevisionISO).toBe("2026-05-20");
    // Meses completos desde mayo-2026 hasta el mes en curso.
    const hoy = new Date();
    const esperado =
      (hoy.getFullYear() - 2026) * 12 + (hoy.getMonth() + 1 - 5);
    expect(tk.mesesSinRevision).toBe(Math.max(0, esperado));
  });
});

describe("la publicidad", () => {
  test("se atribuye ENTERA a Mercadeo, no se reparte", async () => {
    // En la hoja es una sola bolsa. Repartirla entre canales sería inventar un
    // dato que no existe.
    const t = await conFilas(
      [
        { channel: "Publicidad", amountCRC: 600_000 },
        { channel: "TikTok", amountCRC: 100_000 },
        { channel: "Referido", amountCRC: 100_000 },
      ],
      [{ amountCRC: 200_000 }],
    );
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    expect(res.publicidad.canalAtribuido).toBe("Mercadeo");
    expect(res.publicidad.totalCRC).toBe(200_000);
    expect(res.publicidad.rowsAtribuidas).toBe(1);
    expect(res.publicidad.costoPorRevisionCRC).toBe(200_000);
    expect(res.publicidad.retornoPorColon).toBe(3); // 600.000 / 200.000
  });

  test("los meses SIN pauta anotada quedan fuera del costo por revisión", async () => {
    // Es el caso real de la hoja: los primeros meses traen revisiones de
    // Mercadeo y ningún renglón de publicidad. Si esas revisiones entraran al
    // denominador, el costo saldría barato solo porque falta el gasto —y se
    // leería como una mejora.
    const t = await conFilas(
      [
        // Mayo: 4 revisiones, sin pauta anotada.
        ...Array.from({ length: 4 }, () => ({
          channel: "Publicidad",
          inspectionDate: dia("2026-05-10"),
          amountCRC: 50_000,
        })),
        // Julio: 2 revisiones, con pauta.
        ...Array.from({ length: 2 }, () => ({
          channel: "Publicidad",
          inspectionDate: dia("2026-07-10"),
          amountCRC: 50_000,
        })),
      ],
      [{ amountCRC: 100_000, date: dia("2026-07-05"), yearMonth: "2026-07" }],
    );
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    expect(res.publicidad.mesesSinPautaRegistrada).toBe(1);
    expect(res.publicidad.rowsCanalTotal).toBe(6); // el canal completo
    expect(res.publicidad.rowsAtribuidas).toBe(2); // solo las de julio
    // ₡100.000 / 2, no / 6.
    expect(res.publicidad.costoPorRevisionCRC).toBe(50_000);
    expect(res.publicidad.retornoPorColon).toBe(1); // 100.000 de ingreso / 100.000
  });

  test("sin pauta el retorno es 0, no infinito", async () => {
    const t = await conFilas([{ channel: "Publicidad", amountCRC: 600_000 }]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    expect(res.publicidad.totalCRC).toBe(0);
    expect(res.publicidad.retornoPorColon).toBe(0);
    expect(Number.isFinite(res.publicidad.costoPorRevisionCRC)).toBe(true);
  });

  test("solo cuenta gastos de publicidad, no los demás", async () => {
    const t = await conFilas(
      [{ channel: "Publicidad", amountCRC: 100_000 }],
      [
        { amountCRC: 50_000 },
        { amountCRC: 999_000, category: "salario" },
        { amountCRC: 999_000, category: "publicidad", isDeleted: true },
        { amountCRC: 999_000, category: "publicidad", kind: "income" },
      ],
    );
    const res = await t.query(internal.bi.channels.channelRevenue, {});
    expect(res.publicidad.totalCRC).toBe(50_000);
  });
});

describe("la serie mensual", () => {
  test("un mes con pauta y sin revisiones NO desaparece", async () => {
    // Es el mes que más importa ver: se gastó y no entró nada.
    const t = await conFilas(
      [{ channel: "Publicidad", inspectionDate: dia("2026-07-10") }],
      [{ amountCRC: 80_000, date: dia("2026-06-05"), yearMonth: "2026-06" }],
    );
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    const junio = res.porMes.find((m: any) => m.ym === "2026-06");
    expect(junio).toBeDefined();
    expect(junio.rows).toBe(0);
    expect(junio.publicidadCRC).toBe(80_000);
  });

  test("va ordenada y cada mes cuadra con sus canales", async () => {
    const t = await conFilas([
      { channel: "Publicidad", inspectionDate: dia("2026-06-10"), amountCRC: 10_000 },
      { channel: "TikTok", inspectionDate: dia("2026-07-10"), amountCRC: 20_000 },
      { channel: "Publicidad", inspectionDate: dia("2026-07-11"), amountCRC: 30_000 },
    ]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    expect(res.porMes.map((m: any) => m.ym)).toEqual(["2026-06", "2026-07"]);
    for (const m of res.porMes) {
      expect(m.canales.reduce((a: number, c: any) => a + c.ingresosCRC, 0)).toBe(
        m.ingresosCRC,
      );
      expect(m.canales.reduce((a: number, c: any) => a + c.rows, 0)).toBe(m.rows);
    }
  });

  test("marca el mes en curso como incompleto", async () => {
    // Sin esto, el costo por revisión del mes corriente se lee como un logro
    // cuando en realidad es un mes a medio facturar.
    const hoy = new Date();
    const ym = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const t = await conFilas([
      { channel: "Publicidad", inspectionDate: Date.now(), amountCRC: 50_000 },
      { channel: "Publicidad", inspectionDate: dia("2025-09-10"), amountCRC: 50_000 },
    ]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    expect(res.porMes.find((m: any) => m.ym === ym)?.enCurso).toBe(true);
    expect(res.porMes.find((m: any) => m.ym === "2025-09")?.enCurso).toBe(false);
  });
});

describe("el periodo", () => {
  test("es semiabierto: una revisión EXACTAMENTE en el corte cae del lado nuevo", async () => {
    // Dos periodos contiguos no pueden contar la misma revisión dos veces, y el
    // caso que lo decide es el del borde exacto. No es hipotético: las
    // revisiones legacy vienen de fechas sin hora, así que caen justo a
    // medianoche — con un `>` en vez de `>=` se contarían en los dos periodos.
    const corte = Date.parse("2026-07-01T00:00:00-06:00");
    const t = await conFilas([
      { channel: "Publicidad", inspectionDate: dia("2026-06-30"), amountCRC: 10_000 },
      { channel: "Publicidad", inspectionDate: corte, amountCRC: 20_000 },
    ]);
    const antes = await t.query(internal.bi.channels.channelRevenue, { toMs: corte });
    const desde = await t.query(internal.bi.channels.channelRevenue, { fromMs: corte });

    expect(antes.totalIngresosCRC).toBe(10_000);
    expect(desde.totalIngresosCRC).toBe(20_000);
    expect(antes.totalRows + desde.totalRows).toBe(2);
  });

  test("el periodo también recorta la pauta", async () => {
    // Si no, el costo por revisión mezclaría el gasto de un año con las
    // revisiones de un mes.
    const t = await conFilas(
      [{ channel: "Publicidad", inspectionDate: dia("2026-07-10") }],
      [
        { amountCRC: 100_000, date: dia("2026-07-05"), yearMonth: "2026-07" },
        { amountCRC: 900_000, date: dia("2025-12-05"), yearMonth: "2025-12" },
      ],
    );
    const res = await t.query(internal.bi.channels.channelRevenue, {
      fromMs: Date.parse("2026-07-01T00:00:00-06:00"),
    });
    expect(res.publicidad.totalCRC).toBe(100_000);
  });
});

describe("bordes", () => {
  test("sin datos devuelve ceros y listas vacías, no explota", async () => {
    const t = await conFilas([]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    expect(res.totalRows).toBe(0);
    expect(res.totalIngresosCRC).toBe(0);
    expect(res.ticketPromedioCRC).toBe(0);
    expect(res.canales).toEqual([]);
    expect(res.porMes).toEqual([]);
  });

  test("los porcentajes suman ~100 y ninguno es NaN", async () => {
    const t = await conFilas([
      { channel: "Publicidad", amountCRC: 60_000 },
      { channel: "TikTok", amountCRC: 51_000 },
      { channel: "Recompra", amountCRC: 57_000 },
    ]);
    const res = await t.query(internal.bi.channels.channelRevenue, {});

    const suma = res.canales.reduce((a: number, c: any) => a + c.pctIngresos, 0);
    expect(Math.abs(suma - 100)).toBeLessThanOrEqual(0.3); // redondeo a 1 decimal
    for (const c of res.canales) expect(Number.isFinite(c.pctIngresos)).toBe(true);
  });

  /*
   * Acá había una prueba que afirmaba el CONTENIDO del campo `nota` — que
   * mencionara `finance_entries` y `leads`. Se cayó con el campo (A151), y vale
   * anotar por qué no se reemplaza por otra igual:
   *
   * **la prueba pasaba y el usuario no veía nada.** `nota` viajaba del backend
   * y ningún JSX la pintaba, así que lo único verificado era que un string
   * existiera. Una prueba verde sobre un texto que nadie muestra da la
   * sensación de que la salvedad está cubierta, y es justo lo contrario.
   *
   * La salvedad sigue viva y **sí se ve**: el pie de `ChannelDashboard` dice que
   * estos ingresos no son los del tablero de Finanzas y que los dos números son
   * correctos. Donde se lee, que es donde tiene que estar.
   */
});
