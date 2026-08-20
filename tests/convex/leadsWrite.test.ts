/**
 * Los tres endpoints de escritura restantes (A37):
 * `/leads/payment-status`, `/leads/mark-followup` y `POST /bot/onoff`.
 *
 * El que más importa es **mark-followup**: es la pieza que evita el doble
 * mensaje al cliente. Por eso su contrato es de *reclamo* (`claimed`) y no de
 * simple registro — quien pone la bandera en `true` es el único que tiene
 * derecho a enviar.
 *
 * Los dos de lead **nunca crean**: un estado de pago sobre un contacto que no
 * existe es señal de que algo viene mal más arriba, no una razón para inventar
 * una ficha. Eso se prueba explícitamente, porque el error opuesto —crear en
 * silencio— llenaría la base de fichas fantasma que nadie pidió.
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

const TOKEN = "token-de-prueba";
const AUTH = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};
const AYER = Date.parse("2026-08-10T09:00:00-06:00");

beforeEach(() => {
  process.env.N8N_INGEST_TOKEN = TOKEN;
});

function filaBase(over: Record<string, unknown> = {}) {
  return {
    dedupKey: "mc-1",
    manychatId: "mc-1",
    phone8: "22334455",
    phoneValid: true,
    leadStage: "contactado" as const,
    source: "airtable_migration" as const,
    airtableId: "rec1",
    isDeleted: false,
    createdAt: AYER,
    updatedAt: AYER,
    ...over,
  };
}

async function sembrar(
  t: ReturnType<typeof convexTest>,
  over: Record<string, unknown> = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("leads_contacts", filaBase(over) as never),
  );
}

const pago = (t: ReturnType<typeof convexTest>, args: Record<string, unknown>) =>
  t.mutation(internal.bots.leadsWrite.setPaymentStatus, args as never);
const seguimiento = (
  t: ReturnType<typeof convexTest>,
  args: Record<string, unknown>,
) => t.mutation(internal.bots.leadsWrite.markFollowup, args as never);

describe("/leads/payment-status", () => {
  test("cambia el estado y reporta la transición", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t, { paymentStatus: "esperando" });

    const res = await pago(t, { manychatId: "mc-1", status: "recibido" });
    expect(res.found).toBe(true);
    expect(res.previous).toBe("esperando");
    expect(res.current).toBe("recibido");
    expect(res.changed).toBe(true);
  });

  test("repetir el mismo estado es idempotente y lo dice", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t, { paymentStatus: "recibido" });

    const res = await pago(t, { manychatId: "mc-1", status: "recibido" });
    expect(res.changed).toBe(false); // no-op, pero no un error
    expect(res.found).toBe(true);
  });

  test("NO crea el lead si no existe", async () => {
    const t = convexTest(schema, convexModules);
    const res = await pago(t, { manychatId: "no-existe", status: "recibido" });

    expect(res.found).toBe(false);
    const filas = await t.run((ctx) => ctx.db.query("leads_contacts").collect());
    expect(filas).toHaveLength(0);
  });

  test("resuelve también por teléfono", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t);
    const res = await pago(t, { phone: "2233-4455", status: "expirado" });
    expect(res.matchedBy).toBe("phone8");
    expect(res.found).toBe(true);
  });
});

describe("/leads/mark-followup — la pieza anti-doble-mensaje", () => {
  test("la primera llamada RECLAMA; la segunda ya no", async () => {
    // Es todo el contrato: si `claimed` es false, alguien más ya mandó ese
    // mensaje y este flujo no debe volver a mandarlo.
    const t = convexTest(schema, convexModules);
    await sembrar(t);

    const primera = await seguimiento(t, { manychatId: "mc-1", window: "2h" });
    expect(primera.claimed).toBe(true);
    expect(primera.previous).toBe(false);

    const segunda = await seguimiento(t, { manychatId: "mc-1", window: "2h" });
    expect(segunda.claimed).toBe(false);
    expect(segunda.previous).toBe(true);
  });

  test("cada ventana escribe SU bandera y ninguna otra", async () => {
    // Se prueban las tres, una por una. Si dos ventanas compartieran bandera,
    // el bot se saltaría un mensaje entero y nada lo delataría — probar solo
    // dos de las tres dejaba justo ese hueco.
    const casos = [
      { window: "2h", flag: "followup2hDone" },
      { window: "23h", flag: "followup23hDone" },
      { window: "48h", flag: "followup48hDone" },
    ] as const;

    for (const caso of casos) {
      const t = convexTest(schema, convexModules);
      await sembrar(t);
      const res = await seguimiento(t, { manychatId: "mc-1", window: caso.window });
      expect(res.claimed, caso.window).toBe(true);

      const fila = await t.run(async (ctx) =>
        (await ctx.db.query("leads_contacts").collect())[0],
      );
      for (const otro of casos) {
        const esperado = otro.flag === caso.flag ? true : undefined;
        expect(
          (fila as unknown as Record<string, unknown>)[otro.flag],
          `${caso.window} tocó ${otro.flag}`,
        ).toBe(esperado);
      }
    }
  });

  test("`done:false` libera la bandera y permite volver a reclamar", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t);

    await seguimiento(t, { manychatId: "mc-1", window: "2h" });
    const liberada = await seguimiento(t, {
      manychatId: "mc-1", window: "2h", done: false,
    });
    expect(liberada.claimed).toBe(false); // liberar no es reclamar

    const otra = await seguimiento(t, { manychatId: "mc-1", window: "2h" });
    expect(otra.claimed).toBe(true);
  });

  test("liberar una bandera que nunca se marcó NO otorga el reclamo", async () => {
    // `claimed` autoriza a enviar. Una llamada con `done:false` jamás debería
    // autorizar nada — y menos sobre una bandera que estaba en blanco.
    const t = convexTest(schema, convexModules);
    await sembrar(t);

    const res = await seguimiento(t, {
      manychatId: "mc-1", window: "2h", done: false,
    });
    expect(res.previous).toBe(false);
    expect(res.claimed).toBe(false);
  });

  test("NO crea el lead si no existe", async () => {
    const t = convexTest(schema, convexModules);
    const res = await seguimiento(t, { manychatId: "no-existe", window: "2h" });
    expect(res.found).toBe(false);
    expect(res.claimed).toBe(false); // y sobre todo: no autoriza a enviar

    const filas = await t.run((ctx) => ctx.db.query("leads_contacts").collect());
    expect(filas).toHaveLength(0);
  });

  test("con teléfono duplicado avisa de la ambigüedad", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t, { dedupKey: "a", manychatId: undefined, lastContactAt: AYER });
    await sembrar(t, {
      dedupKey: "b", manychatId: undefined,
      airtableId: "rec2", lastContactAt: AYER + 1000,
    });

    const res = await seguimiento(t, { phone: "2233-4455", window: "2h" });
    expect(res.ambiguous).toBe(true);

    const aviso = (
      await t.run((ctx) => ctx.db.query("bi_quality_issues").collect())
    ).find((a) => a.issueType === "ambiguous_upsert");
    expect(aviso).toBeDefined();
  });
});

describe("POST /bot/onoff", () => {
  test("la API puede apagar y prender", async () => {
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/bot/onoff", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ enabled: false, note: "pausa del bot" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.updatedVia).toBe("api");
  });

  test("revertir lo que fijó el tablero deja aviso — la precedencia no está definida", async () => {
    // Si Esteban apaga el bot y quince minutos después vuelve solo, tiene que
    // quedar rastro de por qué. No inventamos una política de bloqueo que
    // después haya que deshacer (H2).
    const t = convexTest(schema, convexModules);
    await t.mutation(internal.bots.settings.setGlobal, {
      enabled: false,
      updatedBy: "user_admin_esteban",
      updatedVia: "dashboard",
    });

    await t.fetch("/bot/onoff", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ enabled: true }),
    });

    const aviso = (
      await t.run((ctx) => ctx.db.query("bi_quality_issues").collect())
    ).find((a) => a.issueType === "onoff_conflict");
    expect(aviso).toBeDefined();
    expect(aviso!.entity).toBe("bot_settings");
  });

  test("coincidir con el tablero NO es conflicto", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(internal.bots.settings.setGlobal, {
      enabled: false,
      updatedBy: "user_admin_esteban",
      updatedVia: "dashboard",
    });

    await t.fetch("/bot/onoff", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ enabled: false }),
    });

    const avisos = await t.run((ctx) =>
      ctx.db.query("bi_quality_issues").collect(),
    );
    expect(avisos.filter((a) => a.issueType === "onoff_conflict")).toHaveLength(0);
  });

  test("`enabled` ausente o no booleano → 400", async () => {
    const t = convexTest(schema, convexModules);
    for (const body of [{}, { enabled: "true" }, { enabled: 1 }]) {
      const res = await t.fetch("/bot/onoff", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify(body),
      });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  test("apagar por API vacía la lista de seguimientos", async () => {
    // Las dos piezas juntas: el kill-switch se aplica en la fuente, así que
    // apagarlo desde n8n deja al bot sin nadie a quien escribirle.
    const t = convexTest(schema, convexModules);
    await sembrar(t, { lastContactAt: Date.now() - 5 * 60 * 60 * 1000 });

    const antes = await t.query(internal.bots.followups.dueFollowups, { window: "2h" });
    expect(antes.count).toBe(1);

    await t.fetch("/bot/onoff", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ enabled: false }),
    });

    const despues = await t.query(internal.bots.followups.dueFollowups, { window: "2h" });
    expect(despues.count).toBe(0);
    expect(despues.botEnabled).toBe(false);
  });
});

describe("los endpoints HTTP", () => {
  test("404 cuando la identidad no resuelve, con la salida a mano", async () => {
    const t = convexTest(schema, convexModules);
    for (const [ruta, cuerpo] of [
      ["/leads/payment-status", { manychatId: "no-existe", status: "recibido" }],
      ["/leads/mark-followup", { manychatId: "no-existe", window: "2h" }],
    ] as const) {
      const res = await t.fetch(ruta, {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify(cuerpo),
      });
      expect(res.status, ruta).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("not_found");
      expect(body.message).toContain("/leads/upsert"); // le dice qué hacer
    }
  });

  test("los tres exigen credencial", async () => {
    const t = convexTest(schema, convexModules);
    for (const ruta of [
      "/leads/payment-status",
      "/leads/mark-followup",
      "/bot/onoff",
    ]) {
      const res = await t.fetch(ruta, { method: "POST", body: "{}" });
      expect(res.status, ruta).toBe(401);
    }
  });

  test("un valor fuera del contrato falla de una vez", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t);
    const res = await t.fetch("/leads/payment-status", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ manychatId: "mc-1", status: "inventado" }),
    });
    expect(res.status).toBe(400);
  });

  test("200 con el reclamo cuando todo va bien", async () => {
    const t = convexTest(schema, convexModules);
    await sembrar(t);
    const res = await t.fetch("/leads/mark-followup", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ manychatId: "mc-1", window: "23h" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed).toBe(true);
    expect(body.window).toBe("23h");
  });
});
