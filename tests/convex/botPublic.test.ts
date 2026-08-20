/**
 * Superficie pública del on/off del bot (`bots/public.ts`).
 *
 * Dos cosas que proteger, y la segunda es la que de verdad importa:
 *
 *  1. **El gate.** Es un control operativo sobre la atención a clientes: nadie
 *     sin rol admin puede leerlo ni tocarlo.
 *  2. **Que el tablero no mienta sobre su efecto.** Mientras la API de bots esté
 *     cerrada, apagar desde el panel **no apaga nada** — el bot sigue con
 *     Airtable. `apiConectada` es lo que le permite a la pantalla decirlo. Si
 *     ese campo se rompiera y devolviera `true` siempre, el aviso desaparecería
 *     y Esteban creería que detuvo al bot cuando no. Ese es el daño real.
 */
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const ADMIN = "user_bot_admin";
const TECNICO = "user_bot_tecnico";

beforeEach(() => {
  delete process.env.N8N_INGEST_TOKEN;
});
afterEach(() => {
  delete process.env.N8N_INGEST_TOKEN;
});

async function setup() {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [clerkId, role, email] of [
      [ADMIN, "admin", "a@example.com"],
      [TECNICO, "tecnico", "t@example.com"],
    ] as const) {
      await ctx.db.insert("users", {
        clerkId,
        email,
        role,
        approvalStatus: "approved",
        createdAt: now,
        updatedAt: now,
      });
    }
  });
  return t;
}

describe("el gate", () => {
  test("sin sesión no se puede leer ni escribir", async () => {
    const t = await setup();
    await expect(t.query(api.bots.public.botStatus, {})).rejects.toThrow();
    await expect(
      t.mutation(api.bots.public.setBotEnabled, { enabled: false }),
    ).rejects.toThrow();
  });

  test("un técnico tampoco — no es solo cuestión de estar logueado", async () => {
    const t = await setup();
    const comoTecnico = t.withIdentity({ subject: TECNICO });
    await expect(comoTecnico.query(api.bots.public.botStatus, {})).rejects.toThrow(
      /administrador/i,
    );
    await expect(
      comoTecnico.mutation(api.bots.public.setBotEnabled, { enabled: false }),
    ).rejects.toThrow(/administrador/i);
  });

  test("un admin sí", async () => {
    const t = await setup();
    const estado = await t
      .withIdentity({ subject: ADMIN })
      .query(api.bots.public.botStatus, {});
    expect(estado.enabled).toBe(true);
    expect(estado.isDefault).toBe(true);
  });
});

describe("apiConectada — lo que impide que la pantalla mienta", () => {
  test("sin token configurado es false: el interruptor no puede surtir efecto", async () => {
    const t = await setup();
    const estado = await t
      .withIdentity({ subject: ADMIN })
      .query(api.bots.public.botStatus, {});
    expect(estado.apiConectada).toBe(false);
  });

  test("con token configurado es true", async () => {
    process.env.N8N_INGEST_TOKEN = "un-token";
    const t = await setup();
    const estado = await t
      .withIdentity({ subject: ADMIN })
      .query(api.bots.public.botStatus, {});
    expect(estado.apiConectada).toBe(true);
  });

  test("un token en blanco no cuenta como conectada", async () => {
    // `"   "` es una variable mal puesta, no una API abierta. Si contara,
    // el aviso desaparecería sin que nada esté realmente conectado.
    process.env.N8N_INGEST_TOKEN = "   ";
    const t = await setup();
    const estado = await t
      .withIdentity({ subject: ADMIN })
      .query(api.bots.public.botStatus, {});
    expect(estado.apiConectada).toBe(false);
  });

  test("la mutation devuelve el mismo dato que la query", async () => {
    // Si divergieran, la tarjeta podría perder el aviso justo después de que
    // alguien toca el interruptor — el peor momento para perderlo.
    const t = await setup();
    const comoAdmin = t.withIdentity({ subject: ADMIN });
    const trasEscribir = await comoAdmin.mutation(api.bots.public.setBotEnabled, {
      enabled: false,
    });
    const leido = await comoAdmin.query(api.bots.public.botStatus, {});
    expect(trasEscribir.apiConectada).toBe(leido.apiConectada);
    expect(trasEscribir.enabled).toBe(leido.enabled);
  });
});

describe("la escritura desde el panel", () => {
  test("guarda quién lo tocó y que fue desde el panel", async () => {
    const t = await setup();
    const res = await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.bots.public.setBotEnabled, {
        enabled: false,
        note: "pausa por mantenimiento",
      });
    expect(res.enabled).toBe(false);
    expect(res.updatedBy).toBe(ADMIN);
    expect(res.updatedVia).toBe("dashboard");
    expect(res.note).toBe("pausa por mantenimiento");
    expect(res.isDefault).toBe(false);
  });

  test("una nota en blanco no se guarda como nota vacía", async () => {
    const t = await setup();
    const res = await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.bots.public.setBotEnabled, { enabled: false, note: "   " });
    expect(res.note).toBeNull();
  });

  test("apaga de verdad: la lista de seguimientos queda vacía", async () => {
    // Es la prueba de que el interruptor del panel y el kill-switch que aplica
    // `due-followups` son el MISMO, no dos estados parecidos.
    const t = await setup();
    await t.run((ctx) =>
      ctx.db.insert("leads_contacts", {
        dedupKey: "mc-1",
        manychatId: "mc-1",
        phoneValid: true,
        leadStage: "contactado",
        source: "airtable_migration",
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastContactAt: Date.now() - 5 * 60 * 60 * 1000,
      } as never),
    );

    const antes = await t.query(internal.bots.followups.dueFollowups, { window: "2h" });
    expect(antes.count).toBe(1);

    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.bots.public.setBotEnabled, { enabled: false });

    const despues = await t.query(internal.bots.followups.dueFollowups, { window: "2h" });
    expect(despues.count).toBe(0);
  });

  test("el panel revirtiendo a la API NO genera aviso de conflicto", async () => {
    // El aviso existe para el caso contrario: que los bots reviertan a una
    // persona. Que una persona corrija al bot es el flujo normal, y meterle
    // un aviso ahí solo llenaría el tablero de ruido.
    const t = await setup();
    await t.mutation(internal.bots.settings.setGlobal, {
      enabled: true,
      updatedBy: "api",
      updatedVia: "api",
    });
    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.bots.public.setBotEnabled, { enabled: false });

    const avisos = await t.run((ctx) =>
      ctx.db.query("bi_quality_issues").collect(),
    );
    expect(avisos.filter((a) => a.issueType === "onoff_conflict")).toHaveLength(0);
  });
});
