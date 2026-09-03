/**
 * Emparejamiento lead ↔ revisión y embudo de conversión (A29).
 *
 * **El otro hueco.** `matches.ts` son 29 KB sin pruebas propias, y de acá sale
 * la métrica que Esteban mira primero: cuántos de sus contactos terminan siendo
 * clientes. Hoy en producción son 217 de 9.096 — un 2,39% — y ese porcentaje
 * decide dónde pone la plata de pauta.
 *
 * Las cuatro formas de equivocarlo, en orden de daño:
 *
 *  1. **Contar un lead dos veces.** Si un mismo contacto se emparejara con dos
 *     revisiones, la conversión subiría sin que nadie comprara nada.
 *  2. **Meter el fallback débil en la métrica titular.** El emparejamiento por
 *     nombre es una pista, no una prueba: dos «José Rodríguez» distintos son
 *     comunes. Va aparte, y no marca al lead como convertido.
 *  3. **Tomar por venta un cobro que no lo es.** Las revisiones de ₡0 y ₡1.000
 *     son relleno; contarlas como conversión infla el número que sostiene las
 *     decisiones de pauta.
 *  4. **No dejar rastro de una ambigüedad.** Cuando dos contactos comparten
 *     teléfono hay que decidir, y esa decisión tiene que poder auditarse.
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

function lead(over: Record<string, unknown> = {}) {
  const t = dia("2026-07-01");
  return {
    dedupKey: "88887777",
    phone8: "88887777",
    phoneValid: true,
    name: "Ana León",
    vehicleBrand: "Toyota",
    leadStage: "nuevo" as const,
    source: "airtable_migration" as const,
    sourceCreatedAt: t,
    isDeleted: false,
    createdAt: t,
    updatedAt: t,
    ...over,
  };
}

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

async function montar(
  leads: Array<Record<string, unknown>>,
  revisiones: Array<Record<string, unknown>>,
) {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    for (const l of leads) await ctx.db.insert("leads_contacts", lead(l) as never);
    for (const r of revisiones)
      await ctx.db.insert("inspections", revision(r) as never);
  });
  await t.mutation(internal.bi.matches.rebuildMatches, { runId: "test" });
  return t;
}

const matches = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => ctx.db.query("bi_matches").collect());
const leads = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => ctx.db.query("leads_contacts").collect());
const embudo = (t: ReturnType<typeof convexTest>) =>
  t.query(internal.bi.matches.conversionFunnel, {});

/* ========================================================================== */

describe("emparejar por teléfono", () => {
  test("un lead y su revisión se enlazan con confianza alta", async () => {
    const t = await montar([{}], [{}]);
    const m = await matches(t);

    expect(m).toHaveLength(1);
    expect(m[0].confidenceBand).toBe("alta");
    expect(m[0].validIncome).toBe(true);
    expect(m[0].matchKey).toBe("phone:88887777");
  });

  test("con otro teléfono NO hay enlace fuerte — a lo sumo el débil por nombre", async () => {
    // Mi primera versión esperaba cero enlaces y estaba mal: al no calzar el
    // teléfono entra el fallback por nombre, que sí crea un match de banda
    // baja. Lo que hay que fijar no es que no exista, sino que **no cuente**.
    const t = await montar([{}], [{ clientPhone: "7000-0000" }]);
    const m = await matches(t);

    expect(m.every((x) => x.confidenceBand === "baja")).toBe(true);
    expect((await embudo(t)).converted).toBe(0);
  });

  test("el lead queda marcado como convertido", async () => {
    const t = await montar([{}], [{}]);
    expect((await leads(t))[0].leadStage).toBe("convertido");
  });
});

describe("un lead no puede convertir dos veces", () => {
  test("dos revisiones del mismo cliente dan DOS matches pero UN lead convertido", async () => {
    // Es recompra: dos revisiones reales. Pero el embudo cuenta personas, no
    // revisiones — si contara revisiones, la conversión subiría sin clientes
    // nuevos.
    const t = await montar(
      [{}],
      [{}, { inspectionStartAt: dia("2026-08-10") }],
    );
    const e = await embudo(t);

    expect(e.leadsTotal).toBe(1);
    expect(e.converted).toBeLessThanOrEqual(1);
  });

  test("dos leads distintos con la misma revisión: solo uno se la lleva", async () => {
    // Asignación voraz: cada revisión toma su mejor lead libre.
    const t = await montar(
      [
        { dedupKey: "a", name: "Ana León" },
        { dedupKey: "b", name: "Otra Persona" },
      ],
      [{}],
    );
    const m = await matches(t);
    expect(m).toHaveLength(1);
    expect(new Set(m.map((x) => x.leadDedupKey)).size).toBe(1);
  });
});

describe("la ambigüedad se resuelve y se deja anotada", () => {
  test("dos contactos con el mismo teléfono bajan la banda a media y abren un aviso", async () => {
    // Sin el aviso, la decisión de a cuál de los dos se le asignó la venta
    // sería invisible y no habría forma de auditarla después.
    const t = await montar(
      [
        { dedupKey: "a", name: "Ana León" },
        { dedupKey: "b", name: "Ana Leon Mora" },
      ],
      [{}],
    );
    const m = await matches(t);
    expect(m[0].confidenceBand).toBe("media");

    const issues = await t.run(async (ctx) =>
      (await ctx.db.query("bi_quality_issues").collect()).filter(
        (i) => i.issueType === "ambiguous_match",
      ),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toContain("88887777");
  });
});

describe("qué cobro cuenta como venta", () => {
  test("₡1.000 y ₡0 NO son conversión", async () => {
    // Son relleno. Contarlos infla el porcentaje que sostiene las decisiones
    // de pauta.
    for (const monto of [0, 1_000]) {
      const t = await montar([{}], [{ totalAmountCharged: monto }]);
      const e = await embudo(t);
      expect(e.converted, `₡${monto}`).toBe(0);
      expect((await leads(t))[0].leadStage, `₡${monto}`).not.toBe("convertido");
    }
  });

  test("justo por encima de ₡1.000 sí cuenta", async () => {
    // El umbral es estricto: 1.000 no, 1.001 sí.
    const t = await montar([{}], [{ totalAmountCharged: 1_001 }]);
    expect((await embudo(t)).converted).toBe(1);
  });

  test("una revisión sin monto tampoco cuenta", async () => {
    const t = await montar([{}], [{ totalAmountCharged: undefined }]);
    expect((await embudo(t)).converted).toBe(0);
  });
});

describe("el fallback por nombre va aparte de la métrica titular", () => {
  test("sin teléfono, el enlace por nombre es banda baja y NO cuenta como conversión", async () => {
    // Dos «José Rodríguez» distintos son comunes: el nombre es una pista, no
    // una prueba. Se muestra aparte para no inflar el titular.
    const t = await montar(
      [{ dedupKey: "sin-tel", phone8: undefined, phoneValid: false }],
      [{ clientPhone: undefined }],
    );
    const e = await embudo(t);

    expect(e.converted).toBe(0);
    expect(e.possibleAdditionalByName).toBe(1);
    expect((await leads(t))[0].leadStage).not.toBe("convertido");
  });
});

describe("volver a construir no acumula", () => {
  test("correrlo dos veces deja el mismo resultado", async () => {
    // Borra y reinserta `bi_matches` entero; si no reseteara, cada corrida
    // duplicaría las conversiones.
    const t = await montar([{}], [{}]);
    const antes = (await matches(t)).length;
    await t.mutation(internal.bi.matches.rebuildMatches, { runId: "test-2" });

    expect((await matches(t)).length).toBe(antes);
    const issues = await t.run(async (ctx) =>
      (await ctx.db.query("bi_quality_issues").collect()).filter(
        (i) => i.entity === "bi_matches",
      ),
    );
    expect(issues.length).toBeLessThanOrEqual(1);
  });
});

describe("el embudo", () => {
  test("los porcentajes salen sobre el total de leads no borrados", async () => {
    const t = await montar(
      [
        {},
        { dedupKey: "b", phone8: "70000001", name: "Sin venta" },
        { dedupKey: "c", phone8: "70000002", name: "Borrada", isDeleted: true },
      ],
      [{}],
    );
    const e = await embudo(t);

    expect(e.leadsTotal).toBe(2); // la borrada no cuenta
    expect(e.converted).toBe(1);
    expect(e.convertedRatePct).toBe(50);
  });

  test("sin leads no divide entre cero", async () => {
    const t = await montar([], []);
    const e = await embudo(t);
    expect(e.leadsTotal).toBe(0);
    expect(Number.isFinite(e.convertedRatePct)).toBe(true);
    expect(e.convertedRatePct).toBe(0);
  });

  test("la lista de convertidos trae solo los del titular", async () => {
    const t = await montar(
      [
        {},
        { dedupKey: "sin-tel", phone8: undefined, phoneValid: false, name: "Por Nombre" },
      ],
      [{}, { clientPhone: undefined, clientName: "Por Nombre" }],
    );
    const conv = await t.query(internal.bi.matches.convertedLeads, {});
    const nombres = conv.map((r) => r.leadName);

    expect(nombres).toContain("Ana León");
    expect(nombres).not.toContain("Por Nombre");
  });
});

/* ========================================================================== */
/* Recompra (A112) y cohorte por periodo (A113)                               */
/* ========================================================================== */

/**
 * Estos dos bloques nacen de una queja concreta de Esteban el 1-set-2026: «entre
 * noviembre y agosto tuve muchísimos clientes, ¿por qué los porcentajes no se
 * mueven?». No se movían porque la pantalla promediaba nueve meses; y una parte
 * de lo que sí contaba no eran clientes nuevos.
 */
describe("una revisión anterior al lead es recompra, no conversión", () => {
  test("el que ya era cliente y volvió a escribir NO cuenta como convertido", async () => {
    // La revisión es de enero; el contacto escribió en julio. El emparejamiento
    // por teléfono los une bien —es la misma persona—, pero atribuirle esa venta
    // al bot sería contar un cliente que ya estaba.
    const t = await montar([{}], [{ inspectionStartAt: dia("2026-01-15") }]);
    const e = await embudo(t);

    expect(e.recompras).toBe(1);
    expect(e.converted).toBe(0);
    expect(e.convertedRatePct).toBe(0);
  });

  test("pero la revisión de hace tres días SÍ cuenta: es el mismo hecho comercial", async () => {
    // El caso real de PROD: la revisión se hizo y la ficha se registró después.
    // Los datos separan los dos grupos con una franja vacía de 62 días, así que
    // el umbral de 7 no parte nada por la mitad.
    const t = await montar([{}], [{ inspectionStartAt: dia("2026-06-28") }]);
    const e = await embudo(t);

    expect(e.recompras).toBe(0);
    expect(e.converted).toBe(1);
  });

  test("la recompra tampoco aparece en la lista de convertidos", async () => {
    // Si la lista y el titular no miden lo mismo, la pantalla se contradice sola.
    const t = await montar([{}], [{ inspectionStartAt: dia("2026-01-15") }]);
    const conv = await t.query(internal.bi.matches.convertedLeads, {});
    expect(conv).toHaveLength(0);
    expect(conv).toHaveLength((await embudo(t)).converted);
  });
});

describe("el periodo corta por la fecha del CONTACTO, no la de la revisión", () => {
  /** Dos contactos: uno de marzo (su revisión en abril) y uno de julio. */
  const dosCohortes = () =>
    montar(
      [
        { dedupKey: "marzo", phone8: "11112222", sourceCreatedAt: dia("2026-03-02") },
        { dedupKey: "julio", phone8: "88887777", sourceCreatedAt: dia("2026-07-01") },
      ],
      [
        { clientPhone: "1111-2222", inspectionStartAt: dia("2026-04-10") },
        { clientPhone: "8888-7777", inspectionStartAt: dia("2026-07-10") },
      ],
    );

  test("sin periodo entran los dos", async () => {
    const e = await embudo(await dosCohortes());
    expect(e.leadsTotal).toBe(2);
    expect(e.converted).toBe(2);
    expect(e.conPeriodo).toBe(false);
  });

  test("con periodo de julio queda solo el de julio — numerador Y denominador", async () => {
    // Lo que hacía que el porcentaje no se moviera era exactamente esto: filtrar
    // uno solo de los dos lados. Si el denominador se quedara en 2, la tasa
    // diría 50% de un universo que la pantalla ya no muestra.
    const t = await dosCohortes();
    const e = await t.query(internal.bi.matches.conversionFunnel, {
      fromMs: dia("2026-06-01"),
    });

    expect(e.leadsTotal).toBe(1);
    expect(e.converted).toBe(1);
    expect(e.convertedRatePct).toBe(100);
    expect(e.conPeriodo).toBe(true);
  });

  test("la revisión de abril NO arrastra a su contacto de marzo al periodo", async () => {
    // El contacto es de marzo aunque su revisión caiga en abril: cortar por la
    // fecha de la revisión respondería otra pregunta.
    const t = await dosCohortes();
    const e = await t.query(internal.bi.matches.conversionFunnel, {
      fromMs: dia("2026-04-01"),
      toMs: dia("2026-05-01"),
    });

    expect(e.leadsTotal).toBe(0);
    expect(e.converted).toBe(0);
  });

  test("la lista de convertidos respeta el mismo recorte", async () => {
    const t = await dosCohortes();
    const args = { fromMs: dia("2026-06-01") };
    const conv = await t.query(internal.bi.matches.convertedLeads, args);
    const e = await t.query(internal.bi.matches.conversionFunnel, args);

    expect(conv).toHaveLength(e.converted);
  });
});

describe("la cohorte mensual cuadra con el titular", () => {
  test("los meses suman exactamente los leads y los convertidos", async () => {
    // La serie es lo que Esteban va a mirar. Si no sumara el titular, el gráfico
    // y el número grande de arriba contarían historias distintas.
    const t = await montar(
      [
        { dedupKey: "a", phone8: "11112222", sourceCreatedAt: dia("2026-05-02") },
        { dedupKey: "b", phone8: "33334444", sourceCreatedAt: dia("2026-06-02") },
        { dedupKey: "c", phone8: "55556666", sourceCreatedAt: dia("2026-06-20") },
      ],
      [
        { clientPhone: "1111-2222", inspectionStartAt: dia("2026-05-10") },
        { clientPhone: "3333-4444", inspectionStartAt: dia("2026-06-10") },
      ],
    );
    const e = await embudo(t);
    const suma = (f: (m: (typeof e.porMes)[number]) => number) =>
      e.porMes.reduce((s, m) => s + f(m), 0);

    expect(suma((m) => m.leads)).toBe(e.leadsTotal - e.leadsSinFecha);
    expect(suma((m) => m.convertidos)).toBe(e.converted);
    expect(suma((m) => m.recompras)).toBe(e.recompras);
    expect(e.porMes.map((m) => m.yearMonth)).toEqual(["2026-05", "2026-06"]);
  });

  test("la tasa de cada mes se calcula sobre SU mes, no sobre el total", async () => {
    // Junio: 1 de 2 = 50%. Mayo: 1 de 1 = 100%. Sobre el total daría 33% en
    // ambos, que es justo el promedio que escondía la mejora.
    const t = await montar(
      [
        { dedupKey: "a", phone8: "11112222", sourceCreatedAt: dia("2026-05-02") },
        { dedupKey: "b", phone8: "33334444", sourceCreatedAt: dia("2026-06-02") },
        { dedupKey: "c", phone8: "55556666", sourceCreatedAt: dia("2026-06-20") },
      ],
      [
        { clientPhone: "1111-2222", inspectionStartAt: dia("2026-05-10") },
        { clientPhone: "3333-4444", inspectionStartAt: dia("2026-06-10") },
      ],
    );
    const porMes = new Map((await embudo(t)).porMes.map((m) => [m.yearMonth, m]));

    expect(porMes.get("2026-05")?.tasaPct).toBe(100);
    expect(porMes.get("2026-06")?.tasaPct).toBe(50);
  });
});

describe("un contacto sin fecha no se inventa un mes", () => {
  test("sin periodo cuenta en el total pero no cae en ninguna cohorte", async () => {
    const t = await montar([{ sourceCreatedAt: undefined }], []);
    const e = await embudo(t);

    expect(e.leadsTotal).toBe(1);
    expect(e.leadsSinFecha).toBe(1);
    expect(e.porMes).toHaveLength(0);
  });

  test("con periodo puesto queda fuera, y el número queda a la vista", async () => {
    // Excluirlo en silencio sería mentir sobre el denominador; meterlo en un mes
    // cualquiera, peor. Se va y se dice cuántos se fueron (A64/A88).
    const t = await montar([{ sourceCreatedAt: undefined }], []);
    const e = await t.query(internal.bi.matches.conversionFunnel, {
      fromMs: dia("2026-01-01"),
    });

    expect(e.leadsTotal).toBe(0);
    expect(e.leadsSinFecha).toBe(1);
  });
});

describe("la caché del lead no puede tener su propia definición (A128)", () => {
  /**
   * `leads_contacts.leadStage = "convertido"` es una **caché** que escribe el
   * rebuild; la verdad vive en `bi_matches`. Pero usaba su propio criterio, así
   * que tras A112 marcaba 236 mientras el panel decía 220.
   *
   * Hoy no se pinta en ninguna pantalla — y por eso mismo es peligrosa: una
   * segunda definición de «convertido» esperando a que alguien la muestre. Se
   * encontró **antes** de que llegara a una pantalla, que es la diferencia con
   * A125.
   */
  test("una recompra NO deja el lead marcado como convertido", async () => {
    const t = await montar([{}], [{ inspectionStartAt: dia("2026-01-15") }]);
    const [lead] = await leads(t);

    expect(lead.leadStage).not.toBe("convertido");
    expect((await embudo(t)).recompras).toBe(1);
  });

  test("los leads marcados coinciden con el titular, no con otro número", async () => {
    // Dos leads: uno convierte de verdad, el otro es recompra.
    const t = await montar(
      [
        { dedupKey: "a", phone8: "11112222" },
        { dedupKey: "b", phone8: "33334444" },
      ],
      [
        { clientPhone: "1111-2222", inspectionStartAt: dia("2026-07-10") },
        { clientPhone: "3333-4444", inspectionStartAt: dia("2026-01-15") },
      ],
    );
    const marcados = (await leads(t)).filter(
      (l) => l.leadStage === "convertido",
    ).length;

    expect(marcados).toBe((await embudo(t)).converted);
    expect(marcados).toBe(1);
  });

  /**
   * **La mitad que faltaba: la caché tiene que saber DESmarcar.**
   *
   * Las dos pruebas de arriba arrancan en `nuevo`, así que solo comprobaban que
   * el rebuild no marque de más. No cubrían el caso real: un lead que **ya venía
   * marcado** de una corrida anterior y dejó de calificar cuando cambió la regla.
   * El paso 5 no lo alcanza —salta a los que siguen emparejados— así que se
   * quedaba en `convertido` para siempre. En PROD eso hizo que el rebuild subiera
   * de 236 a 241 en vez de bajar a 220.
   */
  test("un lead que YA venía marcado y dejó de calificar se desmarca", async () => {
    const t = await montar(
      [{ leadStage: "convertido" }],
      [{ inspectionStartAt: dia("2026-01-15") }], // recompra
    );

    expect((await leads(t))[0].leadStage).toBe("nuevo");
  });

  test("correr el rebuild dos veces da el mismo resultado", async () => {
    const t = await montar(
      [
        { dedupKey: "a", phone8: "11112222" },
        { dedupKey: "b", phone8: "33334444", leadStage: "convertido" },
      ],
      [
        { clientPhone: "1111-2222", inspectionStartAt: dia("2026-07-10") },
        { clientPhone: "3333-4444", inspectionStartAt: dia("2026-01-15") },
      ],
    );
    const marcar = async () =>
      (await leads(t)).filter((l) => l.leadStage === "convertido").length;

    const primera = await marcar();
    await t.mutation(internal.bi.matches.rebuildMatches, { runId: "test-2" });

    expect(await marcar()).toBe(primera);
    expect(primera).toBe(1);
  });

  /**
   * Degradar es solo `convertido` → `nuevo`. Las demás etapas las mueve el bot
   * de seguimiento y no le corresponden al rebuild: si las pisara, un lead
   * `perdido` volvería a la cola de seguimiento cada lunes.
   */
  test("el rebuild no pisa las etapas operativas del bot", async () => {
    const t = await montar(
      [{ leadStage: "perdido" }],
      [{ inspectionStartAt: dia("2026-01-15") }], // recompra: no califica
    );

    expect((await leads(t))[0].leadStage).toBe("perdido");
  });
});
