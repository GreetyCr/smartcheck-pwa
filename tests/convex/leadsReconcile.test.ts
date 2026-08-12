/**
 * RF-16 — reconciliación de conteos Airtable ↔ Convex (A71).
 *
 * Lo que se protege: que una deriva durante el dual-write **se vea**. El modo de
 * fallo real no es que la reconciliación se equivoque, es que diga "todo bien"
 * cuando no lo está — porque entonces nadie vuelve a mirar.
 *
 * La distinción que más importa, y la que se prueba en varias formas: una fila
 * que está en Convex y no en Airtable puede ser **borrada allá** (hay que
 * decidir qué hacer) o **creada por el bot acá** (es lo esperado en dual-write).
 * Confundirlas convierte el tablero en ruido o esconde un borrado real.
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

const ARRANQUE = Date.parse("2026-08-11T03:00:00-06:00");
const ANTES = ARRANQUE - 7 * 24 * 60 * 60 * 1000; // la semana pasada
const DESPUES = ARRANQUE + 30_000; // durante esta corrida

function lead(over: Record<string, unknown> = {}) {
  return {
    dedupKey: `k-${Math.random().toString(36).slice(2)}`,
    phoneValid: true,
    leadStage: "nuevo" as const,
    source: "airtable_migration" as const,
    isDeleted: false,
    createdAt: ANTES,
    updatedAt: DESPUES, // por defecto: tocada por este sync
    ...over,
  };
}

async function sembrar(
  t: ReturnType<typeof convexTest>,
  filas: Array<Record<string, unknown>>,
) {
  await t.run(async (ctx) => {
    for (const f of filas) await ctx.db.insert("leads_contacts", f as never);
  });
}

function reconciliar(
  t: ReturnType<typeof convexTest>,
  over: Record<string, unknown> = {},
) {
  return t.mutation(internal.bi.leadsReconcile.reconcileLeads, {
    runId: "run-prueba",
    syncStartedAt: ARRANQUE,
    airtableCount: 3,
    failedRows: 0,
    isFull: true,
    ...over,
  });
}

describe("cuando todo cuadra", () => {
  test("tres filas traídas y tres tocadas → ok, sin avisos", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t, [
      lead({ airtableId: "rec1" }),
      lead({ airtableId: "rec2" }),
      lead({ airtableId: "rec3" }),
    ]);

    const res = await reconciliar(t);
    expect(res.status).toBe("ok");
    expect(res.seen).toBe(3);
    expect(res.orphans).toBe(0);
    expect(res.delta).toBe(0);

    const avisos = await t.run((ctx) =>
      ctx.db.query("bi_quality_issues").collect(),
    );
    expect(avisos).toHaveLength(0);
  });

  test("las filas que el loader no pudo escribir se descuentan del esperado", async () => {
    // Airtable trajo 3, una falló → se esperan 2. Si no se descontaran, esto
    // reportaría una deriva que en realidad ya está avisada como `load_error`.
    const t = convexTest(schema, convexModules);
    await sembrar(t, [lead({ airtableId: "rec1" }), lead({ airtableId: "rec2" })]);

    const res = await reconciliar(t, { airtableCount: 3, failedRows: 1 });
    expect(res.delta).toBe(0);
    expect(res.status).toBe("ok");
  });
});

describe("huérfanas vs nativas — la distinción que importa", () => {
  test("una fila de Airtable no tocada es huérfana y se avisa CON su airtableId", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t, [
      lead({ airtableId: "rec1" }),
      lead({ airtableId: "rec2" }),
      lead({ airtableId: "recBorrada", updatedAt: ANTES }),
    ]);

    const res = await reconciliar(t, { airtableCount: 2 });
    expect(res.orphans).toBe(1);
    expect(res.seen).toBe(2);
    expect(res.status).toBe("drift");

    const avisos = await t.run((ctx) =>
      ctx.db.query("bi_quality_issues").collect(),
    );
    const huerfana = avisos.find((a) => a.issueType === "lead_orphan");
    expect(huerfana).toBeDefined();
    expect(huerfana!.entityRef).toBe("recBorrada"); // accionable, no un conteo
  });

  test("una fila creada por el bot NO es huérfana — es lo esperado en dual-write", async () => {
    // Si esto se marcara como problema, cada lead que entre por la API nueva
    // generaría un aviso y el tablero se volvería inservible justo cuando más
    // se necesita mirarlo.
    const t = convexTest(schema, convexModules);
    await sembrar(t, [
      lead({ airtableId: "rec1" }),
      lead({ airtableId: "rec2" }),
      lead({ source: "bot", updatedAt: ANTES }), // nació acá, nunca estuvo en Airtable
    ]);

    const res = await reconciliar(t, { airtableCount: 2 });
    expect(res.convexNative).toBe(1);
    expect(res.orphans).toBe(0);
    expect(res.status).toBe("ok");
  });

  test("las creadas a mano tampoco cuentan como huérfanas", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t, [
      lead({ airtableId: "rec1" }),
      lead({ source: "manual", updatedAt: ANTES }),
    ]);

    const res = await reconciliar(t, { airtableCount: 1 });
    expect(res.convexNative).toBe(1);
    expect(res.status).toBe("ok");
  });

  test("las borradas por soft-delete no entran en ningún conteo vivo", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t, [
      lead({ airtableId: "rec1" }),
      lead({ airtableId: "recVieja", isDeleted: true, updatedAt: ANTES }),
    ]);

    const res = await reconciliar(t, { airtableCount: 1 });
    expect(res.softDeleted).toBe(1);
    expect(res.orphans).toBe(0);
    expect(res.convexLive).toBe(1);
    expect(res.status).toBe("ok");
  });
});

describe("deriva de conteos", () => {
  test("faltan filas en Convex → aviso de error con la diferencia", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t, [lead({ airtableId: "rec1" })]);

    const res = await reconciliar(t, { airtableCount: 5 });
    expect(res.delta).toBe(-4);
    expect(res.status).toBe("drift");

    const aviso = (
      await t.run((ctx) => ctx.db.query("bi_quality_issues").collect())
    ).find((a) => a.issueType === "leads_drift");
    expect(aviso).toBeDefined();
    expect(aviso!.severity).toBe("error");
    expect(aviso!.detail).toContain("-4");
  });

  test("una deriva NO se guarda como «ok» en bi_meta", async () => {
    // Si se guardara como ok, el tablero diría que todo está bien mientras el
    // mensaje cuenta lo contrario. Es exactamente el fallo silencioso que esta
    // reconciliación existe para evitar.
    const t = convexTest(schema, convexModules);
    await sembrar(t, [lead({ airtableId: "rec1", updatedAt: ANTES })]);

    await reconciliar(t, { airtableCount: 0 });
    const meta = await t.query(internal.bi.leadsReconcile.reconcileStatus, {});
    expect(meta).not.toBeNull();
    expect(meta!.lastStatus).toBe("error");
    expect(meta!.message).toContain("huérfanas=1");
  });

  test("el tope de avisos trunca pero DICE cuántas quedaron fuera", async () => {
    // Truncar en silencio sería el mismo error que estamos evitando.
    const t = convexTest(schema, convexModules);
    await sembrar(
      t,
      Array.from({ length: 205 }, (_, i) =>
        lead({ airtableId: `rec${i}`, updatedAt: ANTES }),
      ),
    );

    const res = await reconciliar(t, { airtableCount: 0 });
    expect(res.orphans).toBe(205);
    expect(res.orphanIssues).toBe(200);
    expect(res.orphansNotReported).toBe(5);
    expect(res.message).toContain("5 sin avisar por tope");
  });
});

describe("incrementales", () => {
  test("no se reconcilia: «no vino en esta corrida» no significa nada", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t, [lead({ airtableId: "rec1", updatedAt: ANTES })]);

    const res = await reconciliar(t, { isFull: false, airtableCount: 0 });
    expect(res.skipped).toBe(true);
    expect(res.orphans).toBe(0);
    expect(res.status).toBe("ok");

    // Y no ensucia nada: ni avisos ni meta.
    const avisos = await t.run((ctx) =>
      ctx.db.query("bi_quality_issues").collect(),
    );
    expect(avisos).toHaveLength(0);
    expect(await t.query(internal.bi.leadsReconcile.reconcileStatus, {})).toBeNull();
  });
});
