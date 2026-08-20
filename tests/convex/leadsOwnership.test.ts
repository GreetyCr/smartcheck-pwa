/**
 * Propiedad por campo del sync de leads (A66 · decisión N1).
 *
 * El modo de fallo que se está evitando es el peor de todos: **silencioso**. Sin
 * esto, el cron de los lunes hace `patch` de los 27 campos operativos y borra lo
 * que n8n escribió durante la semana, sin error, sin log y sin nada raro. Se ve
 * como si Convex perdiera datos solo.
 *
 * Por eso estas pruebas verifican las dos direcciones, no una: que con el
 * interruptor **apagado** el sync siga pisando (o congelaríamos datos buenos hoy,
 * que es el error opuesto y también cuesta), y que **encendido** suelte
 * exactamente los seis campos acordados y ninguno más.
 */
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const REC = "recPrueba001";
const AYER = Date.parse("2026-08-10T09:00:00-06:00");
const HOY = Date.parse("2026-08-11T09:00:00-06:00");

afterEach(() => {
  delete process.env.CONVEX_OWNS_BOT_FIELDS;
});

/** Lo que Airtable manda en el sync. */
function desdeAirtable(over: Record<string, unknown> = {}) {
  return {
    airtableId: REC,
    phoneValid: true,
    name: "Nombre en Airtable",
    chatbotActive: true,
    paymentStatus: "esperando" as const,
    followup2hDone: false,
    followup23hDone: false,
    followup48hDone: false,
    lastContactAt: AYER,
    ...over,
  };
}

/** Deja una fila ya existente con el estado que "escribió n8n" durante la semana. */
async function conFilaEscritaPorElBot(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.bi.leads.loadLeadsBatch, {
    rows: [desdeAirtable()],
    runId: "carga-inicial",
  });
  await t.run(async (ctx) => {
    const fila = await ctx.db
      .query("leads_contacts")
      .withIndex("by_airtable_id", (q) => q.eq("airtableId", REC))
      .unique();
    await ctx.db.patch(fila!._id, {
      chatbotActive: false, // Esteban lo apagó desde el tablero
      paymentStatus: "recibido", // el bot cobró
      followup2hDone: true, // el bot ya mandó el mensaje de 2 h
      lastContactAt: HOY, // y el cliente respondió hoy
    });
  });
}

async function leerFila(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("leads_contacts")
      .withIndex("by_airtable_id", (q) => q.eq("airtableId", REC))
      .unique(),
  );
}

describe("interruptor apagado (comportamiento de hoy)", () => {
  test("el sync pisa los campos del bot — Airtable sigue mandando", async () => {
    const t = convexTest(schema, convexModules);
    await conFilaEscritaPorElBot(t);

    const res = await t.mutation(internal.bi.leads.loadLeadsBatch, {
      rows: [desdeAirtable()],
      runId: "sync-semanal",
    });

    const fila = await leerFila(t);
    expect(fila!.chatbotActive).toBe(true); // se perdió el apagado de Esteban
    expect(fila!.paymentStatus).toBe("esperando"); // se perdió el cobro
    expect(fila!.followup2hDone).toBe(false); // ← el doble mensaje
    expect(fila!.lastContactAt).toBe(AYER);
    expect(res.ownedRespected).toBe(0);
  });
});

describe("interruptor encendido (dual-write)", () => {
  test("respeta los seis campos que Convex pasa a poseer", async () => {
    const t = convexTest(schema, convexModules);
    await conFilaEscritaPorElBot(t);
    process.env.CONVEX_OWNS_BOT_FIELDS = "true";

    const res = await t.mutation(internal.bi.leads.loadLeadsBatch, {
      rows: [desdeAirtable()],
      runId: "sync-semanal",
    });

    const fila = await leerFila(t);
    expect(fila!.chatbotActive).toBe(false);
    expect(fila!.paymentStatus).toBe("recibido");
    expect(fila!.followup2hDone).toBe(true);
    expect(res.ownedRespected).toBe(1);
  });

  test("`lastContactAt` queda protegido — de él dependen las ventanas de seguimiento", async () => {
    // Se prueba aparte a propósito: es el que se cayó de la lista original y el
    // que mueve los cortes de 2/23/48 h si Airtable lo re-escribe.
    const t = convexTest(schema, convexModules);
    await conFilaEscritaPorElBot(t);
    process.env.CONVEX_OWNS_BOT_FIELDS = "true";

    await t.mutation(internal.bi.leads.loadLeadsBatch, {
      rows: [desdeAirtable()],
      runId: "sync-semanal",
    });

    const fila = await leerFila(t);
    expect(fila!.lastContactAt).toBe(HOY);
  });

  test("`appointmentAt` queda protegido — el bot agenda citas por el upsert", async () => {
    // Se sumó a la lista revisando el handoff contra el código: sin esto, una
    // cita puesta el martes volvía al valor de Airtable el lunes siguiente.
    const t = convexTest(schema, convexModules);
    await conFilaEscritaPorElBot(t);
    process.env.CONVEX_OWNS_BOT_FIELDS = "true";
    const CITA = HOY + 3 * 24 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      const fila = await ctx.db
        .query("leads_contacts")
        .withIndex("by_airtable_id", (q) => q.eq("airtableId", REC))
        .unique();
      await ctx.db.patch(fila!._id, { appointmentAt: CITA });
    });

    await t.mutation(internal.bi.leads.loadLeadsBatch, {
      rows: [desdeAirtable({ appointmentAt: AYER })],
      runId: "sync-semanal",
    });

    const fila = await leerFila(t);
    expect(fila!.appointmentAt).toBe(CITA);
  });

  test("los demás campos SÍ se siguen actualizando — el BI no se queda ciego", async () => {
    // Es la razón de haber elegido propiedad por campo en vez de apagar el sync.
    const t = convexTest(schema, convexModules);
    await conFilaEscritaPorElBot(t);
    process.env.CONVEX_OWNS_BOT_FIELDS = "true";

    await t.mutation(internal.bi.leads.loadLeadsBatch, {
      rows: [
        desdeAirtable({
          name: "Nombre corregido",
          vehicleBrand: "Toyota",
          locality: "Alajuela",
        }),
      ],
      runId: "sync-semanal",
    });

    const fila = await leerFila(t);
    expect(fila!.name).toBe("Nombre corregido");
    expect(fila!.vehicleBrand).toBe("Toyota");
    expect(fila!.locality).toBe("Alajuela");
  });

  test("en un ALTA sí se toman de Airtable — no hay nada que respetar todavía", async () => {
    const t = convexTest(schema, convexModules);
    process.env.CONVEX_OWNS_BOT_FIELDS = "true";

    const res = await t.mutation(internal.bi.leads.loadLeadsBatch, {
      rows: [desdeAirtable({ chatbotActive: false, lastContactAt: AYER })],
      runId: "alta",
    });

    const fila = await leerFila(t);
    expect(res.inserted).toBe(1);
    expect(fila!.chatbotActive).toBe(false);
    expect(fila!.lastContactAt).toBe(AYER);
    expect(res.ownedRespected).toBe(0); // el contador es de patches, no de altas
  });

  test("solo cuenta como encendido el string exacto \"true\"", async () => {
    const t = convexTest(schema, convexModules);
    await conFilaEscritaPorElBot(t);
    process.env.CONVEX_OWNS_BOT_FIELDS = "1"; // valor plausible pero incorrecto

    const res = await t.mutation(internal.bi.leads.loadLeadsBatch, {
      rows: [desdeAirtable()],
      runId: "sync-semanal",
    });

    expect(res.ownedRespected).toBe(0);
    expect((await leerFila(t))!.chatbotActive).toBe(true);
  });
});
