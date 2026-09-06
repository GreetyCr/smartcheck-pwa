/**
 * Calidad & operación de las revisiones (RF-07).
 *
 * **La regla que hay que blindar es una sola, y es la polaridad.** En el
 * checklist «sí» no siempre es malo: `fuga_aceite: sí` es un defecto, pero
 * `extintor: sí` es que el carro trae extintor. De los 44 ítems sí/no del
 * esquema, **18 son hallazgo cuando la respuesta es NO**. Si eso se invierte,
 * el tablero le dice a Esteban que los defectos más comunes de su flota son
 * «tiene gata» y «tiene llanta de repuesto», y el número que sale de ahí no se
 * parece en nada al informe que el cliente ya recibió.
 *
 * Lo demás que se fija son los tres denominadores, que es donde un tablero
 * miente sin equivocarse en ninguna cuenta:
 *
 *  1. El % de un ítem va sobre las veces que **se evaluó**, no sobre el total.
 *  2. El % de condición va sobre las revisiones **con dato**.
 *  3. El SLA va sobre las entregadas **con las dos fechas**, y las que faltan
 *     se cuentan aparte en vez de desaparecer.
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
const HORA = 3_600_000;

function revision(over: Record<string, unknown> = {}) {
  return {
    clientName: "Ana León",
    clientPhone: "8888-7777",
    vehicleBrand: "Toyota",
    totalAmountCharged: 60_000,
    inspectionStartAt: dia("2026-07-10"),
    province: "san_jose",
    ...over,
  };
}

/**
 * Monta N revisiones, cada una con las secciones que se le pasen.
 *
 * `secciones` es `{ tabla: { clave: valor } }` — se escribe la sección literal
 * en vez de un helper genérico para que cada prueba muestre **el ítem exacto**
 * cuya polaridad está fijando.
 */
async function montar(
  revisiones: Array<{
    insp?: Record<string, unknown>;
    secciones?: Record<string, Record<string, unknown>>;
  }>,
) {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    for (const r of revisiones) {
      const id = await ctx.db.insert(
        "inspections",
        revision(r.insp) as never,
      );
      for (const [tabla, campos] of Object.entries(r.secciones ?? {})) {
        await ctx.db.insert(tabla as never, {
          inspectionId: id,
          ...campos,
        } as never);
      }
    }
  });
  return t;
}

const correr = (t: ReturnType<typeof convexTest>) =>
  t.query(internal.bi.operacion.operacion, {});

const item = (
  res: Awaited<ReturnType<typeof correr>>,
  clave: string,
) => res.hallazgos.top.find((r) => r.item === clave);

/**
 * N revisiones que responden lo mismo a un ítem.
 *
 * **Nunca hay que tener dos `montar` vivos a la vez.** `convexTest` monta un
 * backend en memoria compartido: crear la segunda instancia pisa a la primera,
 * así que consultar la primera *después* devuelve los datos de la segunda. Eso
 * hizo fallar dos pruebas —el escenario «con fuga» leía las filas del escenario
 * «sin fuga» y daba cero hallazgos, que es justo lo que la prueba buscaba
 * desmentir—. La regla: montar, consultar, recién entonces montar el siguiente.
 */
const diez = (tabla: string, clave: string, valor: string) =>
  Array.from({ length: 10 }, () => ({
    secciones: { [tabla]: { [clave]: { value: valor } } },
  }));

/* ========================================================================== */

describe("la polaridad de cada ítem, que es toda la corrección de este tablero", () => {
  test("«fuga de aceite: SÍ» es hallazgo; «no», no", async () => {
    const conFuga = await correr(await montar(diez("section_motor", "fuga_aceite", "si")));
    expect(item(conFuga, "fuga_aceite")?.hallazgos).toBe(10);

    const sinFuga = await correr(await montar(diez("section_motor", "fuga_aceite", "no")));
    expect(sinFuga.hallazgos.total).toBe(0);
  });

  test("«extintor: NO» es hallazgo y «sí» NO lo es — al revés que el anterior", async () => {
    // El caso que discrimina. Un tablero que asuma «sí = malo» reportaría acá
    // cero hallazgos y, en el escenario inverso, diría que el defecto más común
    // de la flota es traer extintor.
    const sinExtintor = await correr(await montar(diez("section_seguridad", "extintor", "no")));
    expect(item(sinExtintor, "extintor")?.hallazgos).toBe(10);

    const conExtintor = await correr(await montar(diez("section_seguridad", "extintor", "si")));
    expect(conExtintor.hallazgos.total).toBe(0);
  });

  test("«reparación» es hallazgo y «bien» no, en los ítems de tres estados", async () => {
    const t = await montar([
      ...Array.from({ length: 6 }, () => ({
        secciones: { section_motor: { nivel_aceite: { value: "reparacion" } } },
      })),
      ...Array.from({ length: 4 }, () => ({
        secciones: { section_motor: { nivel_aceite: { value: "bien" } } },
      })),
    ]);
    const r = item(await correr(t), "nivel_aceite");

    expect(r?.hallazgos).toBe(6);
    expect(r?.evaluados).toBe(10);
    expect(r?.pct).toBe(60);
  });

  test("«no aplica» no es hallazgo NI entra en el denominador", async () => {
    // Si `na` contara como evaluado, un ítem que casi nunca aplica se vería
    // como si estuviera casi siempre bien.
    const t = await montar([
      ...Array.from({ length: 10 }, () => ({
        secciones: { section_motor: { fuga_aceite: { value: "si" } } },
      })),
      ...Array.from({ length: 90 }, () => ({
        secciones: { section_motor: { fuga_aceite: { value: "na" } } },
      })),
    ]);
    const r = item(await correr(t), "fuga_aceite");

    expect(r?.evaluados).toBe(10);
    expect(r?.pct).toBe(100);
  });
});

describe("los denominadores", () => {
  test("el % de un ítem va sobre las veces que se evaluó, no sobre el total de revisiones", async () => {
    // 10 revisiones evalúan el ítem y 5 de ellas dan hallazgo; otras 40 ni
    // siquiera tienen la sección. El número correcto es 50%, no 10%.
    const t = await montar([
      ...Array.from({ length: 5 }, () => ({
        secciones: { section_motor: { fuga_aceite: { value: "si" } } },
      })),
      ...Array.from({ length: 5 }, () => ({
        secciones: { section_motor: { fuga_aceite: { value: "no" } } },
      })),
      ...Array.from({ length: 40 }, () => ({})),
    ]);
    const res = await correr(t);

    expect(res.revisiones.total).toBe(50);
    expect(res.hallazgos.evaluadas).toBe(10);
    expect(item(res, "fuga_aceite")?.pct).toBe(50);
  });

  test("el % de condición va sobre las que TIENEN dato", async () => {
    const conChecklist = { section_motor: { nivel_aceite: { value: "bien" } } };
    const t = await montar([
      ...Array.from({ length: 3 }, () => ({
        insp: { biVehicleCondition: 1 },
        secciones: conChecklist,
      })),
      { insp: { biVehicleCondition: 2 }, secciones: conChecklist },
      // Con checklist pero sin la nota de condición: ésas SÍ son «sin dato».
      ...Array.from({ length: 2 }, () => ({ secciones: conChecklist })),
    ]);
    const res = await correr(t);

    expect(res.condicion.sinDato).toBe(2);
    expect(res.condicion.niveles[0].pct).toBe(75); // 3 de 4, no 3 de 6
    expect(res.condicion.niveles[1].pct).toBe(25);
  });

  test("una revisión SIN checklist no entra en la tarjeta de condición", async () => {
    /**
     * **A157.** La tarjeta corría sobre TODAS las revisiones mientras el
     * encabezado de la pantalla declara «N con checklist». En producción eran
     * 172 contra 170: la tarjeta decía «166 con dato» y «6 sin nota» bajo un
     * título que dice 170, así que quien restara obtenía 164.
     */
    const t = await montar([
      {
        insp: { biVehicleCondition: 1 },
        secciones: { section_motor: { nivel_aceite: { value: "bien" } } },
      },
      ...Array.from({ length: 4 }, () => ({})), // sin checklist: fuera
    ]);
    const res = await correr(t);

    const conDato = res.condicion.niveles.reduce((n, x) => n + x.rows, 0);
    expect(conDato + res.condicion.sinDato).toBe(res.revisiones.conChecklist);
    expect(res.condicion.sinDato).toBe(0);
  });
});

describe("el ranking no se deja encabezar por un caso suelto", () => {
  test("un ítem con pocas evaluaciones queda fuera y se CUENTA", async () => {
    // Un ítem visto una vez, y esa vez con hallazgo, daría 100% y saldría
    // primero. Se excluye, pero el recorte tiene que ser visible.
    const t = await montar([
      { secciones: { section_direccion: { fugas_liquido: { value: "si" } } } },
      ...Array.from({ length: 12 }, () => ({
        secciones: { section_motor: { fuga_aceite: { value: "si" } } },
      })),
    ]);
    const res = await correr(t);

    expect(item(res, "fugas_liquido")).toBeUndefined();
    expect(item(res, "fuga_aceite")?.hallazgos).toBe(12);
    expect(res.hallazgos.fueraDelRanking).toBe(1);
  });
});

describe("el SLA", () => {
  test("solo mide las entregadas con las DOS fechas, y dice cuántas quedaron fuera", async () => {
    const ini = dia("2026-07-10");
    const t = await montar([
      { insp: { inspectionStartAt: ini, reportDeliveredAt: ini + 2 * HORA } },
      { insp: { inspectionStartAt: ini, reportDeliveredAt: ini + 6 * HORA } },
      // Entregada pero sin fecha de inicio: no se puede medir.
      { insp: { inspectionStartAt: undefined, reportDeliveredAt: ini } },
      // Ni siquiera entregada: no entra en ningún lado del SLA.
      { insp: { inspectionStartAt: ini } },
    ]);
    const { sla } = await correr(t);

    expect(sla.entregadas).toBe(3);
    expect(sla.medibles).toBe(2);
    expect(sla.sinFechaInicio).toBe(1);
    expect(sla.medianaHoras).toBe(4);
  });

  test("una entrega ANTERIOR al inicio se aparta en vez de hundir la mediana", async () => {
    // Es un dato imposible. Metida como duración negativa correría la mediana
    // sin que nada en pantalla explicara por qué.
    const ini = dia("2026-07-10");
    const t = await montar([
      { insp: { inspectionStartAt: ini, reportDeliveredAt: ini + 10 * HORA } },
      { insp: { inspectionStartAt: ini, reportDeliveredAt: ini - 50 * HORA } },
    ]);
    const { sla } = await correr(t);

    expect(sla.inconsistentes).toBe(1);
    expect(sla.medibles).toBe(1);
    expect(sla.medianaHoras).toBe(10);
  });

  test("sin ninguna medible devuelve ceros y no NaN", async () => {
    const t = await montar([
      { insp: { inspectionStartAt: undefined, reportDeliveredAt: dia("2026-07-10") } },
    ]);
    const { sla } = await correr(t);

    expect(sla.medibles).toBe(0);
    expect(Number.isFinite(sla.medianaHoras)).toBe(true);
    expect(Number.isFinite(sla.p90Horas)).toBe(true);
    expect(sla.medianaHoras).toBe(0);
  });

  test("los cortes de 24 h y 48 h incluyen el borde", async () => {
    const ini = dia("2026-07-10");
    const t = await montar([
      { insp: { inspectionStartAt: ini, reportDeliveredAt: ini + 24 * HORA } },
      { insp: { inspectionStartAt: ini, reportDeliveredAt: ini + 48 * HORA } },
      { insp: { inspectionStartAt: ini, reportDeliveredAt: ini + 49 * HORA } },
    ]);
    const { sla } = await correr(t);

    expect(sla.dentroDe24h).toBe(1);
    expect(sla.dentroDe48h).toBe(2);
  });
});

describe("el catálogo tiene que estar completo, y si no, se nota", () => {
  test("hoy no hay ni un ítem sin catalogar", async () => {
    const t = await montar([
      {
        secciones: {
          section_motor: {
            fuga_aceite: { value: "si" },
            nivel_aceite: { value: "bien" },
            notas_adicional: "texto libre, no es un ítem",
          },
        },
      },
    ]);
    expect((await correr(t)).hallazgos.itemsSinCatalogar).toEqual([]);
  });
});
