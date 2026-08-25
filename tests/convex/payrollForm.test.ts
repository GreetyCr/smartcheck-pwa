/**
 * Registro de la planilla del mes (B28).
 *
 * Lo que hay que proteger, en orden de qué duele más si falla:
 *
 *  1. **Que corregir no duplique.** Esteban va a equivocarse escribiendo un
 *     salario y va a volver a confirmar. Si eso creara seis líneas más en vez de
 *     actualizar las que ya están, su gasto de planilla se duplicaría y el error
 *     sería casi invisible: doce filas correctas en vez de seis.
 *  2. **Que corregir recalcule TODO.** Cambiar el salario mueve cinco de las seis
 *     líneas. Si alguna se quedara con el número viejo, quedaría una provisión
 *     inconsistente — que es exactamente lo que ya nos pasó con los ₡98.599.
 *  3. **Que nadie las edite a mano.** Se re-derivan; una edición manual se
 *     perdería en silencio en el siguiente recálculo.
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

const ADMIN = "user_planilla_admin";
const TECNICO = "user_planilla_tecnico";

const JULIO = {
  yearMonth: "2026-07",
  salarioCRC: 430_000,
  comisionesCRC: 73_000,
  baseImponibleCRC: 1_000_000,
};

async function setup() {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [clerkId, role] of [
      [ADMIN, "admin"],
      [TECNICO, "tecnico"],
    ] as const) {
      await ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@example.com`,
        role,
        approvalStatus: "approved",
        createdAt: now,
        updatedAt: now,
      });
    }
  });
  return { t, admin: t.withIdentity({ subject: ADMIN }) };
}

const filasDePlanilla = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) =>
    (await ctx.db.query("finance_entries").collect()).filter(
      (r) => r.source === "planilla" && !r.isDeleted,
    ),
  );

/**
 * Mete una fila como las que dejó la migración de la hoja de Esteban.
 *
 * Se usa para montar el escenario de **B34**: marzo a julio de 2026 ya traen las
 * seis líneas con llave `sheet:<MES> 2026:<etiqueta>:<n>`.
 */
const filaDeLaHoja = (
  t: ReturnType<typeof convexTest>,
  {
    etiqueta,
    amountCRC,
    yearMonth = "2026-07",
    category = "salario",
    kind = "expense" as "expense" | "income",
    source = "sheet" as "sheet" | "manual",
    conLlave = true,
    isDeleted = false,
  }: {
    etiqueta: string;
    amountCRC: number;
    yearMonth?: string;
    category?: string;
    kind?: "expense" | "income";
    source?: "sheet" | "manual";
    /** `false` simula la captura a mano: sin `externalKey`, la etiqueta va en la nota. */
    conLlave?: boolean;
    isDeleted?: boolean;
  },
) =>
  t.run(async (ctx) => {
    const now = Date.now();
    const mes = yearMonth.replace("-", " ");
    return ctx.db.insert("finance_entries", {
      kind,
      category,
      isViatico: false,
      amountCRC,
      originalCurrency: "CRC",
      date: now,
      yearMonth,
      source,
      externalKey: conLlave ? `sheet:${mes}:${etiqueta}:1` : undefined,
      note: conLlave ? undefined : etiqueta,
      isDeleted,
      createdAt: now,
      updatedAt: now,
    });
  });

describe("el gate", () => {
  test("un técnico no puede registrar planilla", async () => {
    const { t } = await setup();
    await expect(
      t.withIdentity({ subject: TECNICO }).mutation(api.bi.payroll.registrarPlanilla, JULIO),
    ).rejects.toThrow(/administrador/i);
    expect(await filasDePlanilla(t)).toHaveLength(0);
  });

  test("sin sesión tampoco", async () => {
    const { t } = await setup();
    await expect(
      t.mutation(api.bi.payroll.registrarPlanilla, JULIO),
    ).rejects.toThrow();
  });
});

describe("registrar el mes", () => {
  test("crea las seis líneas con los montos de julio", async () => {
    const { t, admin } = await setup();
    const res = await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);

    expect(res.creadas).toBe(6);
    expect(res.actualizadas).toBe(0);
    expect(res.totalCRC).toBe(115_756 + 41_900 * 3 + 20_957 + 130_000);

    const filas = await filasDePlanilla(t);
    expect(filas).toHaveLength(6);
    // Todas al último día del mes, como las que vinieron de la hoja.
    expect(new Set(filas.map((f) => f.yearMonth))).toEqual(new Set(["2026-07"]));
  });

  test("las provisiones van a `salario` y los impuestos a `impuestos`", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const filas = await filasDePlanilla(t);
    expect(filas.filter((f) => f.category === "salario")).toHaveLength(5);
    expect(filas.filter((f) => f.category === "impuestos")).toHaveLength(1);
  });

  test("guarda los insumos y se pueden volver a leer", async () => {
    const { admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);

    const leido = await admin.query(api.bi.payroll.planillaDelMes, {
      yearMonth: "2026-07",
    });
    expect(leido.insumos).not.toBeNull();
    expect(leido.insumos!.salarioCRC).toBe(430_000);
    expect(leido.insumos!.comisionesCRC).toBe(73_000);
    expect(leido.lineas).toHaveLength(6);
  });

  test("un mes sin registrar devuelve insumos en null, no un error", async () => {
    const { admin } = await setup();
    const leido = await admin.query(api.bi.payroll.planillaDelMes, {
      yearMonth: "2026-01",
    });
    expect(leido.insumos).toBeNull();
    expect(leido.lineas).toEqual([]);
  });
});

describe("corregir el mes — lo que más duele si falla", () => {
  test("volver a confirmar ACTUALIZA, no duplica", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const segunda = await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);

    expect(segunda.creadas).toBe(0);
    expect(segunda.actualizadas).toBe(6);
    expect(await filasDePlanilla(t)).toHaveLength(6); // sigue siendo seis
  });

  test("corregir el salario recalcula las CINCO líneas que dependen de él", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    await admin.mutation(api.bi.payroll.registrarPlanilla, {
      ...JULIO,
      salarioCRC: 500_000,
    });

    const filas = await filasDePlanilla(t);
    expect(filas).toHaveLength(6);
    const porLlave = new Map(filas.map((f) => [f.externalKey, f.amountCRC]));
    expect(porLlave.get("planilla:2026-07:aporte_patronal")).toBe(
      Math.round(500_000 * 0.2692),
    );
    // Y vacaciones, que depende del aporte patronal recién recalculado.
    expect(porLlave.get("planilla:2026-07:vacaciones")).toBe(
      Math.round((500_000 + Math.round(500_000 * 0.2692)) * 0.0384),
    );
    // Los impuestos NO dependen del salario: se quedan igual.
    expect(porLlave.get("planilla:2026-07:impuestos")).toBe(130_000);
  });

  test("las tres provisiones que valen igual siguen siendo TRES filas", async () => {
    // Comparten monto; si compartieran llave, el gasto se subestimaría en dos
    // tercios y las cifras seguirían pareciendo razonables.
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const filas = await filasDePlanilla(t);
    const de41900 = filas.filter((f) => f.amountCRC === 41_900);
    expect(de41900).toHaveLength(3);
    expect(new Set(de41900.map((f) => f.externalKey)).size).toBe(3);
  });

  test("meses distintos no se pisan entre sí", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    await admin.mutation(api.bi.payroll.registrarPlanilla, {
      ...JULIO,
      yearMonth: "2026-08",
      salarioCRC: 450_000,
    });
    expect(await filasDePlanilla(t)).toHaveLength(12);
  });
});

describe("las seis no se editan a mano", () => {
  test("el listado las marca como no editables", async () => {
    const { admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const filas = await admin.query(api.bi.financeForm.listFinanceEntries, {});
    const dePlanilla = filas.filter((f) => f.source === "planilla");
    expect(dePlanilla).toHaveLength(6);
    for (const f of dePlanilla) expect(f.editable, f.note ?? "").toBe(false);
  });

  test("el formulario rechaza editarlas y borrarlas", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const una = (await filasDePlanilla(t))[0];

    await expect(
      admin.mutation(api.bi.financeForm.updateFinanceEntry, {
        id: una._id,
        kind: "expense",
        category: "salario",
        amountCRC: 1,
        originalCurrency: "CRC",
        date: una.date,
      } as never),
    ).rejects.toThrow();

    await expect(
      admin.mutation(api.bi.financeForm.deleteFinanceEntry, { id: una._id }),
    ).rejects.toThrow();
  });
});

/**
 * **B34** — el mes ya trae estas líneas por otra vía.
 *
 * La idempotencia por llave natural cubre confirmar **dos veces el mismo mes**.
 * No cubre un mes que **ya vino por otro camino**: marzo a julio de 2026 traen
 * las seis líneas desde la hoja con llave `sheet:…`, y esta pantalla escribe con
 * llave `planilla:…`. Llaves distintas ⇒ no se pisan ⇒ el gasto queda doble.
 *
 * Las dos mitades de la regla pesan lo mismo:
 *  - **Bloquear** los meses que ya vinieron de la hoja.
 *  - **NO bloquear** un mes que solo tiene los salarios brutos cargados — que es
 *    exactamente agosto, el único mes con el que Esteban puede estrenar esto.
 *    Un guard que se pasa de celoso acá deja la pantalla inservible.
 */
describe("B34 · un mes que ya trae la planilla por otra vía", () => {
  const SEIS_DE_LA_HOJA = [
    ["APORTE PATRONO CCSS", 115_756],
    ["PROVISION AGUINALDO", 41_900],
    ["PROVISION PREAVISO", 41_900],
    ["PROVISION CESANTIA", 41_900],
    ["PROVISION VACACIONES", 20_957],
    ["IMPUESTOS", 130_000],
  ] as const;

  async function conJulioDeLaHoja() {
    const s = await setup();
    for (const [etiqueta, amountCRC] of SEIS_DE_LA_HOJA) {
      await filaDeLaHoja(s.t, {
        etiqueta,
        amountCRC,
        category: etiqueta === "IMPUESTOS" ? "impuestos" : "salario",
      });
    }
    return s;
  }

  test("se rechaza, y no deja NADA escrito", async () => {
    const { t, admin } = await conJulioDeLaHoja();
    await expect(
      admin.mutation(api.bi.payroll.registrarPlanilla, JULIO),
    ).rejects.toThrow(/ya tiene/i);

    // Ni las seis líneas nuevas…
    expect(await filasDePlanilla(t)).toHaveLength(0);
    // …ni los insumos.
    const guardados = await t.run((ctx) =>
      ctx.db.query("payroll_months").collect(),
    );
    expect(guardados).toHaveLength(0);
    // Nota honesta sobre qué prueba esto y qué no: la mutation es
    // transaccional, así que mover el guard debajo del insert **no** rompe este
    // test —se comprobó—. Lo que sí cubre es que el rechazo no deje residuo,
    // que es la propiedad que le importa a Esteban.
  });

  test("el error dice QUÉ encontró, no solo que falló", async () => {
    // Sin los nombres, Esteban no tiene forma de saber qué dar de baja.
    const { admin } = await conJulioDeLaHoja();
    await expect(
      admin.mutation(api.bi.payroll.registrarPlanilla, JULIO),
    ).rejects.toThrow(/APORTE PATRONO CCSS/);
  });

  test("basta UNA línea preexistente para bloquear el mes", async () => {
    // Enero y febrero solo traen IMPUESTOS. Registrar el mes escribiría las
    // seis, y esa una quedaría doble.
    const { t, admin } = await setup();
    await filaDeLaHoja(t, {
      etiqueta: "IMPUESTOS",
      amountCRC: 158_806,
      yearMonth: "2026-01",
      category: "impuestos",
    });
    await expect(
      admin.mutation(api.bi.payroll.registrarPlanilla, {
        ...JULIO,
        yearMonth: "2026-01",
      }),
    ).rejects.toThrow(/ya tiene/i);
  });

  test("una provisión que NO generamos también bloquea", async () => {
    // `PROVISION DESPIDO` está en la hoja y no es una de nuestras seis. Si la
    // regla fuera una lista cerrada de las seis, esta se colaría.
    const { t, admin } = await setup();
    await filaDeLaHoja(t, { etiqueta: "PROVISION DESPIDO", amountCRC: 40_000 });
    await expect(
      admin.mutation(api.bi.payroll.registrarPlanilla, JULIO),
    ).rejects.toThrow(/ya tiene/i);
  });

  test("una línea capturada A MANO también bloquea", async () => {
    // Sin `externalKey` la etiqueta vive en la nota; duplicaría igual.
    const { t, admin } = await setup();
    await filaDeLaHoja(t, {
      etiqueta: "APORTE PATRONO CCSS",
      amountCRC: 115_756,
      source: "manual",
      conLlave: false,
    });
    await expect(
      admin.mutation(api.bi.payroll.registrarPlanilla, JULIO),
    ).rejects.toThrow(/ya tiene/i);
  });

  test("la otra mitad: los SALARIOS BRUTOS no bloquean — es el caso de agosto", async () => {
    // Agosto solo tiene los dos salarios brutos cargados a mano. Son el
    // **insumo**, no el resultado. Si esto bloqueara, el único mes registrable
    // dejaría de serlo y la pantalla no serviría para nada.
    const { t, admin } = await setup();
    await filaDeLaHoja(t, {
      etiqueta: "SALARIO BRUTO TECNICO",
      amountCRC: 430_000,
      yearMonth: "2026-08",
      source: "manual",
      conLlave: false,
    });
    await filaDeLaHoja(t, {
      etiqueta: "SALARIO JEFE OPERACIONES",
      amountCRC: 800_000,
      yearMonth: "2026-08",
      source: "manual",
      conLlave: false,
    });

    const res = await admin.mutation(api.bi.payroll.registrarPlanilla, {
      ...JULIO,
      yearMonth: "2026-08",
    });
    expect(res.creadas).toBe(6);
  });

  test("una línea dada de baja no bloquea", async () => {
    // Es el camino de salida: se dan de baja las viejas y el mes se libera.
    const { t, admin } = await setup();
    await filaDeLaHoja(t, {
      etiqueta: "APORTE PATRONO CCSS",
      amountCRC: 115_756,
      isDeleted: true,
    });
    const res = await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    expect(res.creadas).toBe(6);
  });

  test("un INGRESO con etiqueta parecida no bloquea", async () => {
    const { t, admin } = await setup();
    await filaDeLaHoja(t, {
      etiqueta: "IMPUESTOS",
      amountCRC: 50_000,
      category: "impuestos",
      kind: "income",
    });
    const res = await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    expect(res.creadas).toBe(6);
  });

  test("bloquea el mes con conflicto y deja pasar el de al lado", async () => {
    const { t, admin } = await setup();
    await filaDeLaHoja(t, {
      etiqueta: "APORTE PATRONO CCSS",
      amountCRC: 115_756,
      yearMonth: "2026-07",
    });
    await expect(
      admin.mutation(api.bi.payroll.registrarPlanilla, JULIO),
    ).rejects.toThrow(/ya tiene/i);

    const res = await admin.mutation(api.bi.payroll.registrarPlanilla, {
      ...JULIO,
      yearMonth: "2026-08",
    });
    expect(res.creadas).toBe(6);
  });

  test("NO rompe la idempotencia: nuestras propias líneas no son conflicto", async () => {
    // Lo más fácil de romper de todo esto: si el guard mirara también
    // `source: "planilla"`, corregir un mes se volvería imposible desde la
    // segunda vez — que es el flujo normal, no el excepcional.
    const { t, admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, JULIO);
    const segunda = await admin.mutation(api.bi.payroll.registrarPlanilla, {
      ...JULIO,
      salarioCRC: 500_000,
    });
    expect(segunda.actualizadas).toBe(6);
    expect(await filasDePlanilla(t)).toHaveLength(6);
  });

  test("la pantalla se entera ANTES: la query devuelve lo que ya está cargado", async () => {
    const { admin } = await conJulioDeLaHoja();
    const leido = await admin.query(api.bi.payroll.planillaDelMes, {
      yearMonth: "2026-07",
    });
    expect(leido.lineasYaCargadas).toHaveLength(6);
    // Ordenadas de mayor a menor: lo que más pesa se lee primero.
    expect(leido.lineasYaCargadas[0].etiqueta).toBe("IMPUESTOS");
    expect(leido.lineasYaCargadas[0].amountCRC).toBe(130_000);
  });

  test("un mes limpio devuelve la lista vacía, no undefined", async () => {
    const { admin } = await setup();
    const leido = await admin.query(api.bi.payroll.planillaDelMes, {
      yearMonth: "2026-08",
    });
    expect(leido.lineasYaCargadas).toEqual([]);
  });
});

describe("validación de entradas", () => {
  test("un mes con formato inválido se rechaza", async () => {
    const { t, admin } = await setup();
    for (const yearMonth of ["2026-13", "julio", "2026/07", "26-07", "2026-7"]) {
      await expect(
        admin.mutation(api.bi.payroll.registrarPlanilla, { ...JULIO, yearMonth }),
        yearMonth,
      ).rejects.toThrow(/mes inválido/i);
    }
    expect(await filasDePlanilla(t)).toHaveLength(0);
  });

  test("montos negativos se rechazan y no dejan nada a medias", async () => {
    const { t, admin } = await setup();
    await expect(
      admin.mutation(api.bi.payroll.registrarPlanilla, {
        ...JULIO,
        salarioCRC: -1,
      }),
    ).rejects.toThrow(/negativo/i);
    expect(await filasDePlanilla(t)).toHaveLength(0);
  });

  test("acepta tasas distintas y las guarda con el mes", async () => {
    // Se congelan por mes: si mañana cambian, los meses viejos siguen
    // explicándose con las que se usaron.
    const { admin } = await setup();
    await admin.mutation(api.bi.payroll.registrarPlanilla, {
      ...JULIO,
      tasas: {
        aportePatronalPct: 25.83,
        provisionPct: 8.33,
        vacacionesPct: 3.84,
        impuestosPct: 13,
      },
    });
    const leido = await admin.query(api.bi.payroll.planillaDelMes, {
      yearMonth: "2026-07",
    });
    expect(leido.insumos!.tasas.aportePatronalPct).toBe(25.83);
    expect(leido.lineas[0].amountCRC).toBe(Math.round(430_000 * 0.2583));
  });
});
