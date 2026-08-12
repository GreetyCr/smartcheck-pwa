/**
 * QA de los cimientos de la API para n8n / ManyChat (A37).
 *
 * Lo que se protege acá es distinto de lo que protegen las pruebas del BI. En el
 * BI el riesgo es que un número salga mal; acá el riesgo es que **un tercero
 * entre sin credencial** o que **el kill-switch no mate nada**. Son las dos
 * cosas que, si fallan, no se notan hasta que ya pasó algo.
 *
 * La disciplina de siempre: cada prueba tiene que poder fallar. Si rompo la
 * regla que dice cuidar, la prueba correspondiente se cae.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const TOKEN = "token-de-prueba-no-es-un-secreto-real";
const AUTH = { Authorization: `Bearer ${TOKEN}` };

const HOUR = 60 * 60 * 1000;
const AHORA = Date.parse("2026-08-11T12:00:00-06:00");

beforeEach(() => {
  process.env.N8N_INGEST_TOKEN = TOKEN;
});

/** Lead mínimo válido; `over` ajusta lo que cada prueba necesita. */
function lead(over: Record<string, unknown> = {}) {
  return {
    dedupKey: `k-${Math.random().toString(36).slice(2)}`,
    phoneValid: true,
    leadStage: "contactado" as const,
    source: "airtable_migration" as const,
    isDeleted: false,
    createdAt: AHORA,
    updatedAt: AHORA,
    ...over,
  };
}

describe("auth de los endpoints", () => {
  test("sin header Authorization → 401", async () => {
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/bot/ping", { method: "GET" });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  test("token incorrecto → 401", async () => {
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/bot/ping", {
      method: "GET",
      headers: { Authorization: "Bearer otra-cosa" },
    });
    expect(res.status).toBe(401);
  });

  test("token correcto pero sin el prefijo Bearer → 401", async () => {
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/bot/ping", {
      method: "GET",
      headers: { Authorization: TOKEN },
    });
    expect(res.status).toBe(401);
  });

  test("un prefijo del token válido NO pasa", async () => {
    // La comparación en tiempo constante sigue siendo una comparación: que no
    // filtre el tiempo no la exime de ser correcta.
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/bot/ping", {
      method: "GET",
      headers: { Authorization: `Bearer ${TOKEN.slice(0, -1)}` },
    });
    expect(res.status).toBe(401);
  });

  test("token correcto → 200", async () => {
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/bot/ping", { method: "GET", headers: AUTH });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test("sin N8N_INGEST_TOKEN en el env → 500, NO 401", async () => {
    // La distinción importa: un 401 manda a Hans a revisar su credencial
    // cuando el problema es que el deployment está a medio configurar.
    delete process.env.N8N_INGEST_TOKEN;
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/bot/ping", { method: "GET", headers: AUTH });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("not_configured");
  });

  test("el error de auth no devuelve el token esperado ni el recibido", async () => {
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/bot/ping", {
      method: "GET",
      headers: { Authorization: "Bearer intento-de-adivinanza" },
    });
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain(TOKEN);
    expect(body).not.toContain("intento-de-adivinanza");
  });

  test("todos los endpoints exigen credencial, no solo el ping", async () => {
    const t = convexTest(schema, convexModules);
    for (const path of [
      "/bot/onoff",
      "/leads/due-followups?window=2h",
    ]) {
      const res = await t.fetch(path, { method: "GET" });
      expect(res.status, `${path} quedó sin auth`).toBe(401);
    }
  });
});

describe("kill-switch global", () => {
  test("sin fila configurada responde ENCENDIDO y lo marca como default", async () => {
    // Conservar el estado actual: apagar el bot tiene que ser un acto explícito.
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/bot/onoff", { method: "GET", headers: AUTH });
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.isDefault).toBe(true);
  });

  test("guarda quién lo apagó, cómo y cuándo", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(internal.bots.settings.setGlobal, {
      enabled: false,
      updatedBy: "user_admin_esteban",
      updatedVia: "dashboard",
      note: "pausa por mantenimiento",
    });
    const body = await (
      await t.fetch("/bot/onoff", { method: "GET", headers: AUTH })
    ).json();
    expect(body.enabled).toBe(false);
    expect(body.updatedBy).toBe("user_admin_esteban");
    expect(body.updatedVia).toBe("dashboard");
    expect(body.note).toBe("pausa por mantenimiento");
    expect(body.isDefault).toBe(false);
    expect(typeof body.updatedAt).toBe("number");
  });

  test("apagar y volver a prender no duplica la fila", async () => {
    const t = convexTest(schema, convexModules);
    for (const enabled of [false, true, false]) {
      await t.mutation(internal.bots.settings.setGlobal, {
        enabled,
        updatedBy: "user_admin_esteban",
        updatedVia: "dashboard",
      });
    }
    const filas = await t.run((ctx) => ctx.db.query("bot_settings").collect());
    expect(filas).toHaveLength(1);
    expect(filas[0].enabled).toBe(false);
  });
});

describe("GET /leads/due-followups", () => {
  test("`window` inválido o ausente → 400", async () => {
    const t = convexTest(schema, convexModules);
    for (const qs of ["", "?window=", "?window=5h", "?window=2"]) {
      const res = await t.fetch(`/leads/due-followups${qs}`, {
        method: "GET",
        headers: AUTH,
      });
      expect(res.status, `"${qs}" debería ser 400`).toBe(400);
    }
  });

  test("`limit` no numérico → 400", async () => {
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/leads/due-followups?window=2h&limit=abc", {
      method: "GET",
      headers: AUTH,
    });
    expect(res.status).toBe(400);
  });

  test("devuelve solo los vencidos de la ventana pedida", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "leads_contacts",
        lead({ name: "Vencido", lastContactAt: AHORA - 5 * HOUR }) as never,
      );
      await ctx.db.insert(
        "leads_contacts",
        lead({ name: "Reciente", lastContactAt: AHORA - 1 * HOUR }) as never,
      );
    });

    const body = await t.query(internal.bots.followups.dueFollowups, {
      window: "2h",
      nowMs: AHORA,
    });
    expect(body.count).toBe(1);
    expect(body.leads[0].name).toBe("Vencido");
    expect(body.leads[0].hoursSinceContact).toBe(5);
  });

  test("el flag ya marcado excluye al lead — es la idempotencia anti-doble-mensaje", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "leads_contacts",
        lead({
          name: "Ya avisado",
          lastContactAt: AHORA - 5 * HOUR,
          followup2hDone: true,
        }) as never,
      );
    });

    const dos = await t.query(internal.bots.followups.dueFollowups, {
      window: "2h",
      nowMs: AHORA,
    });
    expect(dos.count).toBe(0);

    // Pero sigue pendiente del de 48h: los flags son por ventana, no globales.
    const cuarentaOcho = await t.query(internal.bots.followups.dueFollowups, {
      window: "48h",
      nowMs: AHORA + 48 * HOUR,
    });
    expect(cuarentaOcho.count).toBe(1);
  });

  test("un lead sin `lastContactAt` NO es un seguimiento vencido", async () => {
    // En el índice, las filas sin el campo ordenan antes que cualquier número:
    // un `lte` mal acotado se las tragaría todas y el bot escribiría a gente
    // que nunca fue contactada.
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert("leads_contacts", lead({ name: "Sin contacto" }) as never);
    });
    const body = await t.query(internal.bots.followups.dueFollowups, {
      window: "2h",
      nowMs: AHORA,
    });
    expect(body.count).toBe(0);
  });

  test("excluye borrados, apagados por-lead y estados terminales", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      const base = { lastContactAt: AHORA - 5 * HOUR };
      await ctx.db.insert("leads_contacts", lead({ ...base, isDeleted: true }) as never);
      await ctx.db.insert("leads_contacts", lead({ ...base, chatbotActive: false }) as never);
      await ctx.db.insert("leads_contacts", lead({ ...base, leadStage: "convertido" }) as never);
      await ctx.db.insert("leads_contacts", lead({ ...base, leadStage: "perdido" }) as never);
      await ctx.db.insert("leads_contacts", lead({ ...base, leadStage: "expirado" }) as never);
      // El único que sí debe salir.
      await ctx.db.insert("leads_contacts", lead({ ...base, name: "Elegible" }) as never);
    });
    const body = await t.query(internal.bots.followups.dueFollowups, {
      window: "2h",
      nowMs: AHORA,
    });
    expect(body.count).toBe(1);
    expect(body.leads[0].name).toBe("Elegible");
  });

  test("`chatbotActive` sin configurar cuenta como encendido", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "leads_contacts",
        lead({ name: "Sin configurar", lastContactAt: AHORA - 5 * HOUR }) as never,
      );
    });
    const body = await t.query(internal.bots.followups.dueFollowups, {
      window: "2h",
      nowMs: AHORA,
    });
    expect(body.count).toBe(1);
  });

  test("con el bot apagado la lista viene VACÍA, no solo marcada", async () => {
    // El kill-switch se aplica en la fuente. Si dependiera de que n8n lea el
    // flag y decida respetarlo, no sería un kill-switch.
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "leads_contacts",
        lead({ name: "Vencido", lastContactAt: AHORA - 5 * HOUR }) as never,
      );
    });

    const antes = await t.query(internal.bots.followups.dueFollowups, {
      window: "2h",
      nowMs: AHORA,
    });
    expect(antes.count).toBe(1);

    await t.mutation(internal.bots.settings.setGlobal, {
      enabled: false,
      updatedBy: "user_admin_esteban",
      updatedVia: "dashboard",
    });

    const despues = await t.query(internal.bots.followups.dueFollowups, {
      window: "2h",
      nowMs: AHORA,
    });
    expect(despues.botEnabled).toBe(false);
    expect(despues.leads).toEqual([]);
    expect(despues.count).toBe(0);
  });

  test("`limit` corta la tanda y avisa que hay más", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert(
          "leads_contacts",
          lead({ name: `L${i}`, lastContactAt: AHORA - (5 + i) * HOUR }) as never,
        );
      }
    });
    const body = await t.query(internal.bots.followups.dueFollowups, {
      window: "2h",
      limit: 2,
      nowMs: AHORA,
    });
    expect(body.count).toBe(2);
    expect(body.hasMore).toBe(true);
  });

  test("el endpoint HTTP responde con la misma forma que la query interna", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "leads_contacts",
        lead({ name: "Vencido", lastContactAt: Date.now() - 5 * HOUR }) as never,
      );
    });
    const res = await t.fetch("/leads/due-followups?window=2h", {
      method: "GET",
      headers: AUTH,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = await res.json();
    expect(body.window).toBe("2h");
    expect(body.botEnabled).toBe(true);
    expect(body.count).toBe(1);
    expect(body.leads[0].name).toBe("Vencido");
  });
});
