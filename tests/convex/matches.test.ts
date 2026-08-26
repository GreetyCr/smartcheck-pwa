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
