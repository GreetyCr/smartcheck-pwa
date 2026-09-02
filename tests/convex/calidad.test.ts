/**
 * Calidad de los datos (F3).
 *
 * Lo que este tablero puede hacer mal, en orden de daño:
 *
 *  1. **Meter el ruido junto con lo accionable.** En PROD hay 2.158 avisos y
 *     1.869 son duplicados que se marcan a propósito. Mostrarlos juntos entrena
 *     a ignorar el tablero, y ahí se pierden los pocos que importan.
 *  2. **Esconder un tipo nuevo.** Si un `issueType` sin catalogar cayera en
 *     «esperado», se ocultaría solo — y los tipos nuevos son justo los que nadie
 *     miró todavía.
 *  3. **Contar los resueltos como pendientes**, que infla el número que la gente
 *     lee primero.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CATALOGO } from "../../convex/bi/calidad";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const now = 1_787_000_000_000;

function issue(over: Record<string, unknown> = {}) {
  return {
    issueType: "lead_dup",
    severity: "info" as const,
    entity: "leads_contacts",
    entityRef: "rec1",
    detail: "dup manychatId 123 (grupo de 2)",
    runId: "run-1",
    detectedAt: now,
    resolved: false,
    ...over,
  };
}

const sembrar = async (issues: Array<Record<string, unknown>>) => {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    for (const i of issues) await ctx.db.insert("bi_quality_issues", issue(i) as never);
  });
  return t;
};

const pedir = (t: ReturnType<typeof convexTest>) =>
  t.query(internal.bi.calidad.calidad, {});

const tipo = (res: any, k: string) => res.tipos.find((x: any) => x.issueType === k);

/* ========================================================================== */

describe("separar el ruido de lo accionable", () => {
  test("los duplicados de contacto NO cuentan como algo que arreglar", async () => {
    // Es el punto entero del tablero: 1.869 avisos que no piden nada.
    const t = await sembrar([
      ...Array.from({ length: 50 }, () => ({ issueType: "lead_dup" })),
      { issueType: "reconciliation_gap", severity: "warn", detail: "gap 2026-07" },
    ]);
    const res = await pedir(t);

    expect(res.porClase.accion).toBe(1);
    expect(res.porClase.esperado).toBe(50);
    expect(res.sinResolver).toBe(51);
  });

  test("la clase NO se deduce de la severidad", async () => {
    // `anomalous_phone` es info y `ambiguous_match` es warn, y los dos son
    // igual de poco accionables. Si la clase saliera de la severidad, uno de
    // los dos quedaría en la casilla equivocada.
    const t = await sembrar([
      { issueType: "anomalous_phone", severity: "info" },
      { issueType: "ambiguous_match", severity: "warn" },
    ]);
    const res = await pedir(t);

    expect(res.porClase.accion).toBe(0);
    expect(res.porClase.informativo).toBe(2);
  });

  test("lo que pide acción va primero en la lista", async () => {
    const t = await sembrar([
      ...Array.from({ length: 99 }, () => ({ issueType: "lead_dup" })),
      { issueType: "reconciliation_gap", severity: "warn" },
    ]);
    const res = await pedir(t);
    // Aunque `lead_dup` sea 99 veces más grande.
    expect(res.tipos[0].issueType).toBe("reconciliation_gap");
  });
});

describe("un tipo que nadie clasificó", () => {
  test("cae en «pide acción», no en ruido", async () => {
    // Si el default fuera «esperado», un detector nuevo se escondería solo.
    const t = await sembrar([{ issueType: "algo_que_no_existia", severity: "info" }]);
    const res = await pedir(t);

    expect(tipo(res, "algo_que_no_existia").clase).toBe("accion");
    expect(res.porClase.accion).toBe(1);
  });

  test("y se reporta aparte para poder clasificarlo", async () => {
    const t = await sembrar([
      { issueType: "algo_que_no_existia" },
      { issueType: "lead_dup" },
    ]);
    const res = await pedir(t);

    expect(res.sinCatalogar).toEqual(["algo_que_no_existia"]);
  });

  test("sin tipos nuevos, la lista de sin catalogar viene vacía", async () => {
    const t = await sembrar([{ issueType: "lead_dup" }]);
    expect((await pedir(t)).sinCatalogar).toEqual([]);
  });
});

describe("resueltos vs pendientes", () => {
  test("un aviso resuelto no cuenta en ninguna clase", async () => {
    const t = await sembrar([
      { issueType: "viatico_review", resolved: true },
      { issueType: "viatico_review", resolved: true },
      { issueType: "reconciliation_gap", severity: "warn" },
    ]);
    const res = await pedir(t);

    expect(res.totalIssues).toBe(3);
    expect(res.resueltos).toBe(2);
    expect(res.sinResolver).toBe(1);
    expect(res.porClase.accion + res.porClase.informativo + res.porClase.esperado).toBe(1);
    expect(tipo(res, "viatico_review").resueltos).toBe(2);
  });

  test("los ejemplos salen solo de los pendientes", async () => {
    // Mostrar el detalle de algo ya resuelto manda a mirar donde no hay nada.
    const t = await sembrar([
      { issueType: "reconciliation_gap", severity: "warn", resolved: true, detail: "viejo" },
      { issueType: "reconciliation_gap", severity: "warn", detail: "gap 2026-07" },
    ]);
    expect(tipo(await pedir(t), "reconciliation_gap").ejemplos).toEqual(["gap 2026-07"]);
  });

  test("como mucho tres ejemplos por tipo", async () => {
    const t = await sembrar(
      Array.from({ length: 9 }, (_, i) => ({
        issueType: "reconciliation_gap", severity: "warn", detail: `gap ${i}`,
      })),
    );
    expect(tipo(await pedir(t), "reconciliation_gap").ejemplos).toHaveLength(3);
  });
});

describe("cada tipo se explica en castellano", () => {
  test("todos traen qué es y qué hacer, no solo un número", async () => {
    const t = await sembrar([
      { issueType: "lead_dup" },
      { issueType: "reconciliation_gap", severity: "warn" },
    ]);
    for (const x of (await pedir(t)).tipos) {
      expect(x.titulo.length, x.issueType).toBeGreaterThan(0);
      expect(x.queEs.length, x.issueType).toBeGreaterThan(0);
      expect(x.queHacer.length, x.issueType).toBeGreaterThan(0);
    }
  });

  test("el catálogo no tiene entradas a medias", () => {
    for (const [k, e] of Object.entries(CATALOGO)) {
      expect(["accion", "informativo", "esperado"], k).toContain(e.clase);
      expect(e.titulo.length, k).toBeGreaterThan(0);
      expect(e.queEs.length, k).toBeGreaterThan(0);
      expect(e.queHacer.length, k).toBeGreaterThan(0);
    }
  });
});

describe("cobertura de los datos", () => {
  test("cuenta presentes, faltantes y porcentaje sobre lo NO borrado", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      const base = {
        dedupKey: "k", phone8: "88887777", phoneValid: true, sourceCreatedAt: now,
        leadStage: "nuevo" as const, source: "airtable_migration" as const,
        isDeleted: false, createdAt: now, updatedAt: now,
      };
      await ctx.db.insert("leads_contacts", { ...base, dedupKey: "a", name: "Ana", manychatId: "m1" } as never);
      await ctx.db.insert("leads_contacts", { ...base, dedupKey: "b", phoneValid: false } as never);
      // Borrado: no debe entrar ni en el numerador ni en el denominador.
      await ctx.db.insert("leads_contacts", { ...base, dedupKey: "c", isDeleted: true } as never);
    });
    const cob = (await pedir(t)).cobertura;

    const tel = cob.find((c: any) => c.campo.includes("teléfono"))!;
    expect(tel.total).toBe(2);
    expect(tel.presentes).toBe(1);
    expect(tel.faltan).toBe(1);
    expect(tel.pct).toBe(50);

    const nom = cob.find((c: any) => c.campo.includes("nombre"))!;
    expect(nom.presentes).toBe(1);
  });

  test("sin datos no divide entre cero", async () => {
    const t = await sembrar([]);
    const res = await pedir(t);
    for (const c of res.cobertura) {
      expect(Number.isFinite(c.pct), c.campo).toBe(true);
      expect(c.pct).toBe(0);
    }
    expect(res.totalIssues).toBe(0);
  });
});

/* ========================================================================== */
/* Los gaps de la época manual (A121)                                         */
/* ========================================================================== */

describe("un mes que no cuadra se clasifica por su ÉPOCA, no por su tamaño", () => {
  /**
   * Antes de la captura automática el ingreso se tecleaba, así que la
   * diferencia contra las revisiones es historia contable cerrada. Diez avisos
   * permanentes en «pide acción», con cero resueltos mes tras mes, enseñan a
   * ignorar la pantalla — que es exactamente lo que este tablero existe para
   * evitar. Lo que importa hoy es un gap en un mes **automático**: ese sí
   * significa algo roto.
   *
   * La separación se hace **al leer**, con el `entityRef` del aviso (su mes)
   * contra el primer mes con captura automática. Nada se oculta ni se borra.
   */
  async function conGaps(primerMesAuto: string | null, meses: string[]) {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      if (primerMesAuto) {
        await ctx.db.insert("finance_entries", {
          kind: "income", category: "inspeccion", isViatico: false,
          amountCRC: 60_000, originalCurrency: "CRC",
          date: Date.parse(`${primerMesAuto}-15T10:00:00-06:00`),
          yearMonth: primerMesAuto, source: "inspection",
          isDeleted: false, createdAt: 0, updatedAt: 0,
        } as never);
      }
      for (const ym of meses) {
        await ctx.db.insert("bi_quality_issues", {
          issueType: "reconciliation_gap", entity: "finance_entries",
          entityRef: ym, detail: `gap ${ym}`, severity: "warn",
          resolved: false, detectedAt: 0, runId: "test",
        } as never);
      }
    });
    return t.query(internal.bi.calidad.calidad, {});
  }

  const cuenta = (r: any, tipo: string) =>
    r.tipos.find((x: any) => x.issueType === tipo)?.sinResolver ?? 0;

  test("los anteriores a la captura automática salen de «pide acción»", async () => {
    const r = await conGaps("2026-08", ["2025-09", "2026-01", "2026-07"]);

    expect(cuenta(r, "reconciliation_gap_manual")).toBe(3);
    expect(cuenta(r, "reconciliation_gap")).toBe(0);
    expect(r.porClase.accion).toBe(0);
    expect(r.porClase.informativo).toBe(3);
  });

  test("un mes CON captura automática sigue pidiendo acción", async () => {
    const r = await conGaps("2026-08", ["2026-08", "2026-09"]);

    expect(cuenta(r, "reconciliation_gap")).toBe(2);
    expect(cuenta(r, "reconciliation_gap_manual")).toBe(0);
    expect(r.porClase.accion).toBe(2);
  });

  test("se separan en la misma corrida, no es todo o nada", async () => {
    const r = await conGaps("2026-08", ["2025-09", "2026-08"]);

    expect(cuenta(r, "reconciliation_gap_manual")).toBe(1);
    expect(cuenta(r, "reconciliation_gap")).toBe(1);
  });

  test("sin captura automática todavía, NADA se reclasifica", async () => {
    // Sin una época nueva no hay contra qué comparar: reclasificar ahí sería
    // apagar avisos sin motivo.
    const r = await conGaps(null, ["2025-09", "2026-07"]);

    expect(cuenta(r, "reconciliation_gap")).toBe(2);
    expect(cuenta(r, "reconciliation_gap_manual")).toBe(0);
    expect(r.porClase.accion).toBe(2);
  });

  test("ninguno queda sin catalogar", async () => {
    const r = await conGaps("2026-08", ["2025-09", "2026-08"]);
    expect(r.sinCatalogar).toEqual([]);
  });
});
