/**
 * `POST /leads/upsert` (A37) — la puerta de entrada de n8n a Convex.
 *
 * Lo que hay que proteger acá no es un cálculo, es que **no se pierdan ni se
 * mezclen conversaciones de clientes reales**. Los tres modos de fallo que
 * importan:
 *
 *  1. **Duplicar** — que reintentar cree una fila nueva. n8n tiene *Retry on
 *     Fail*: si el upsert no es idempotente, un timeout parte al cliente en dos.
 *  2. **Escribir en la fila equivocada** — con 476 grupos de teléfono repetido,
 *     un match ambiguo mal resuelto le contesta a la persona equivocada.
 *  3. **Borrar lo que no se mencionó** — n8n manda el pedazo que cambió, no la
 *     fila entera. Un upsert que reemplaza en vez de fusionar vacía el registro.
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
const HOY = Date.parse("2026-08-11T09:00:00-06:00");

beforeEach(() => {
  process.env.N8N_INGEST_TOKEN = TOKEN;
});

function upsert(t: ReturnType<typeof convexTest>, args: Record<string, unknown>) {
  return t.mutation(internal.bots.leadsIngest.upsertLead, args as never);
}

function filaBase(over: Record<string, unknown> = {}) {
  return {
    dedupKey: "k1",
    phoneValid: true,
    leadStage: "contactado" as const,
    source: "airtable_migration" as const,
    isDeleted: false,
    createdAt: AYER,
    updatedAt: AYER,
    ...over,
  };
}

describe("altas", () => {
  test("crea con manychatId y marca el origen como bot", async () => {
    const t = convexTest(schema, convexModules);
    const res = await upsert(t, { manychatId: "mc-1", name: "Ana" });

    expect(res.action).toBe("created");
    expect(res.dedupKey).toBe("mc-1");

    const fila = await t.run((ctx) => ctx.db.get(res.leadId));
    expect(fila!.source).toBe("bot");
    expect(fila!.name).toBe("Ana");
    expect(fila!.leadStage).toBe("nuevo");
  });

  test("normaliza el teléfono igual que el sync", async () => {
    const t = convexTest(schema, convexModules);
    const res = await upsert(t, { phone: "+506 8990-3618" });

    const fila = await t.run((ctx) => ctx.db.get(res.leadId));
    expect(fila!.phone8).toBe("89903618");
    expect(fila!.phoneValid).toBe(true);
  });

  test("rechaza si no hay ninguna llave usable", async () => {
    // Una fila sin llave nace huérfana: nadie puede volver a encontrarla.
    // Ya tenemos 31 así y son justo las que hay que ir a corregir a mano.
    const t = convexTest(schema, convexModules);
    await expect(upsert(t, { name: "Sin llave" })).rejects.toThrow(/manychatId/);
    await expect(upsert(t, { phone: "+1 415 555 0100" })).rejects.toThrow();

    const filas = await t.run((ctx) => ctx.db.query("leads_contacts").collect());
    expect(filas).toHaveLength(0);
  });

  test("un teléfono no normalizable se reporta, no se traga en silencio", async () => {
    const t = convexTest(schema, convexModules);
    const res = await upsert(t, { manychatId: "mc-1", phone: "+1 415 555 0100" });

    expect(res.action).toBe("created");
    expect(res.phoneRejected).toBe(true); // hay llave por manychat, pero avisa
  });

  test("un número extranjero NO se guarda bajo la llave de otro cliente", async () => {
    // El riesgo concreto: normalizePhone se queda con los últimos 8 dígitos, así
    // que "+1 415 555 0100" se vuelve "55550100" — un número tico plausible. Si
    // se guardara como phone8, el próximo upsert del verdadero 5555-0100
    // escribiría sobre la conversación del extranjero, o al revés. El bot le
    // acabaría contestando a la persona equivocada.
    const t = convexTest(schema, convexModules);
    await upsert(t, { manychatId: "mc-extranjero", phone: "+1 415 555 0100" });

    const fila = await t.run(async (ctx) =>
      (await ctx.db.query("leads_contacts").collect())[0],
    );
    expect(fila.phone8).toBeUndefined();
    expect(fila.rawPhone).toBeDefined(); // se conserva para poder auditarlo
    expect(fila.phoneValid).toBe(false);

    // Y el tico real no lo encuentra: son personas distintas.
    const tico = await upsert(t, { phone: "5555-0100" });
    expect(tico.action).toBe("created");

    const avisado = (
      await t.run((ctx) => ctx.db.query("bi_quality_issues").collect())
    ).some((a) => a.detail?.includes("NO se usa como llave"));
    expect(avisado).toBe(true);
  });

  test("el bot NO puede declarar un lead como convertido", async () => {
    // La conversión se deriva de una inspección real con ingreso válido
    // (bi_matches). Si el bot pudiera declararla, el embudo dejaría de medir
    // la realidad y pasaría a medir el optimismo del bot.
    const t = convexTest(schema, convexModules);
    await expect(
      upsert(t, { manychatId: "mc-1", leadStage: "convertido" }),
    ).rejects.toThrow();
  });
});

describe("idempotencia — el reintento de n8n", () => {
  test("la misma llamada dos veces actualiza, no duplica", async () => {
    const t = convexTest(schema, convexModules);
    const a = await upsert(t, { manychatId: "mc-1", name: "Ana" });
    const b = await upsert(t, { manychatId: "mc-1", name: "Ana" });

    expect(a.action).toBe("created");
    expect(b.action).toBe("updated");
    expect(b.leadId).toBe(a.leadId);

    const filas = await t.run((ctx) => ctx.db.query("leads_contacts").collect());
    expect(filas).toHaveLength(1);
  });

  test("encuentra por teléfono una fila que venía de Airtable", async () => {
    const t = convexTest(schema, convexModules);
    await t.run((ctx) =>
      ctx.db.insert(
        "leads_contacts",
        filaBase({ phone8: "89903618", airtableId: "rec1" }) as never,
      ),
    );

    const res = await upsert(t, { phone: "8990-3618", name: "Ana" });
    expect(res.action).toBe("updated");
    expect(res.matchedBy).toBe("phone8");
  });

  test("manychatId gana sobre el teléfono cuando apuntan a filas distintas", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "leads_contacts",
        filaBase({ dedupKey: "mc-1", manychatId: "mc-1" }) as never,
      );
      await ctx.db.insert(
        "leads_contacts",
        filaBase({ dedupKey: "89903618", phone8: "89903618" }) as never,
      );
    });

    const res = await upsert(t, { manychatId: "mc-1", phone: "8990-3618" });
    expect(res.matchedBy).toBe("manychatId");
  });
});

describe("no destruir lo que no se mencionó", () => {
  test("un upsert parcial conserva los campos ausentes", async () => {
    const t = convexTest(schema, convexModules);
    await t.run((ctx) =>
      ctx.db.insert(
        "leads_contacts",
        filaBase({
          manychatId: "mc-1",
          name: "Ana",
          vehicleBrand: "Toyota",
          locality: "Alajuela",
        }) as never,
      ),
    );

    await upsert(t, { manychatId: "mc-1", lastContactAt: HOY });

    const fila = await t.run(async (ctx) =>
      (await ctx.db.query("leads_contacts").collect())[0],
    );
    expect(fila.lastContactAt).toBe(HOY);
    expect(fila.name).toBe("Ana");
    expect(fila.vehicleBrand).toBe("Toyota");
    expect(fila.locality).toBe("Alajuela");
  });

  test("NO cambia el origen de una fila que vino de Airtable", async () => {
    // Si la volviera `bot`, la reconciliación (A73) la contaría como "nativa"
    // y dejaría de vigilar que Airtable la siga mandando.
    const t = convexTest(schema, convexModules);
    await t.run((ctx) =>
      ctx.db.insert(
        "leads_contacts",
        filaBase({ manychatId: "mc-1", airtableId: "rec1" }) as never,
      ),
    );

    await upsert(t, { manychatId: "mc-1", name: "Ana" });

    const fila = await t.run(async (ctx) =>
      (await ctx.db.query("leads_contacts").collect())[0],
    );
    expect(fila.source).toBe("airtable_migration");
    expect(fila.airtableId).toBe("rec1");
  });
});

describe("ambigüedad — 476 grupos de teléfono repetido", () => {
  test("elige la del contacto más reciente y DEJA AVISO", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "leads_contacts",
        filaBase({
          dedupKey: "a", phone8: "89903618",
          airtableId: "recVieja", lastContactAt: AYER,
        }) as never,
      );
      await ctx.db.insert(
        "leads_contacts",
        filaBase({
          dedupKey: "b", phone8: "89903618",
          airtableId: "recNueva", lastContactAt: HOY,
        }) as never,
      );
    });

    const res = await upsert(t, { phone: "8990-3618", name: "Ana" });
    expect(res.ambiguous).toBe(true);
    expect(res.candidates).toBe(2);

    const elegida = await t.run((ctx) => ctx.db.get(res.leadId));
    expect(elegida!.airtableId).toBe("recNueva");

    const aviso = (
      await t.run((ctx) => ctx.db.query("bi_quality_issues").collect())
    ).find((a) => a.issueType === "ambiguous_upsert");
    expect(aviso).toBeDefined();
    expect(aviso!.detail).toContain("2 filas");
  });

  test("un match por teléfono NO reasigna el manychatId de otro", async () => {
    // Lo encontró una llamada de verificación real contra DEV: le pegamos a un
    // lead que existía y le pisamos su manychatId sin que nada avisara. Con 476
    // grupos de teléfono repetido —familias, negocios, números reusados— eso
    // reasigna la conversación de una persona a otra.
    const t = convexTest(schema, convexModules);
    await t.run((ctx) =>
      ctx.db.insert(
        "leads_contacts",
        filaBase({
          manychatId: "890284200",
          phone8: "89903618",
          name: "Cliente real",
          airtableId: "recReal",
        }) as never,
      ),
    );

    const res = await upsert(t, {
      phone: "8990-3618",
      manychatId: "otro-distinto",
      name: "Nombre corregido",
    });

    expect(res.matchedBy).toBe("phone8");
    expect(res.identityConflict).toBe(true);

    const fila = await t.run((ctx) => ctx.db.get(res.leadId));
    expect(fila!.manychatId).toBe("890284200"); // se conserva el que estaba
    expect(fila!.name).toBe("Nombre corregido"); // el resto sí se aplica

    const aviso = (
      await t.run((ctx) => ctx.db.query("bi_quality_issues").collect())
    ).find((a) => a.issueType === "identity_conflict");
    expect(aviso).toBeDefined();
  });

  test("sí completa el manychatId cuando la fila no tenía ninguno", async () => {
    // Rellenar un hueco no es un conflicto: es justamente lo que se espera
    // cuando el bot conoce por primera vez la identidad de ManyChat.
    const t = convexTest(schema, convexModules);
    await t.run((ctx) =>
      ctx.db.insert(
        "leads_contacts",
        filaBase({ phone8: "89903618", airtableId: "recSinMc" }) as never,
      ),
    );

    const res = await upsert(t, { phone: "8990-3618", manychatId: "mc-nuevo" });
    expect(res.identityConflict).toBe(false);
    const fila = await t.run((ctx) => ctx.db.get(res.leadId));
    expect(fila!.manychatId).toBe("mc-nuevo");
  });

  test("el desempate es determinista — dos llamadas caen en la misma fila", async () => {
    // Si no lo fuera, llamadas seguidas escribirían en filas distintas y la
    // conversación quedaría partida entre dos registros.
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      for (const k of ["a", "b", "c"]) {
        await ctx.db.insert(
          "leads_contacts",
          filaBase({ dedupKey: k, phone8: "89903618", lastContactAt: AYER }) as never,
        );
      }
    });

    const uno = await upsert(t, { phone: "8990-3618" });
    const dos = await upsert(t, { phone: "8990-3618" });
    expect(dos.leadId).toBe(uno.leadId);
  });

  test("las borradas no compiten por el match", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "leads_contacts",
        filaBase({
          dedupKey: "a", phone8: "89903618",
          isDeleted: true, lastContactAt: HOY,
        }) as never,
      );
      await ctx.db.insert(
        "leads_contacts",
        filaBase({
          dedupKey: "b", phone8: "89903618",
          airtableId: "recViva", lastContactAt: AYER,
        }) as never,
      );
    });

    const res = await upsert(t, { phone: "8990-3618" });
    expect(res.ambiguous).toBe(false);
    const fila = await t.run((ctx) => ctx.db.get(res.leadId));
    expect(fila!.airtableId).toBe("recViva");
  });
});

describe("el endpoint HTTP", () => {
  test("201 al crear, 200 al actualizar", async () => {
    const t = convexTest(schema, convexModules);
    const crear = await t.fetch("/leads/upsert", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ manychatId: "mc-1", name: "Ana" }),
    });
    expect(crear.status).toBe(201);

    const actualizar = await t.fetch("/leads/upsert", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ manychatId: "mc-1", name: "Ana María" }),
    });
    expect(actualizar.status).toBe(200);
    expect((await actualizar.json()).action).toBe("updated");
  });

  test("exige credencial", async () => {
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/leads/upsert", {
      method: "POST",
      body: JSON.stringify({ manychatId: "mc-1" }),
    });
    expect(res.status).toBe(401);
  });

  test("cuerpo vacío o no-JSON → 400, no 500", async () => {
    const t = convexTest(schema, convexModules);
    for (const body of ["", "no soy json", "[1,2,3]"]) {
      const res = await t.fetch("/leads/upsert", {
        method: "POST",
        headers: AUTH,
        body,
      });
      expect(res.status, `cuerpo ${JSON.stringify(body)}`).toBe(400);
    }
  });

  test("sin llave usable → 400 con el motivo, no un 500 opaco", async () => {
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/leads/upsert", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ name: "Sin llave" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("manychatId");
  });

  test("un campo fuera del contrato falla de una vez", async () => {
    // Un typo en el flujo de n8n tiene que romper visiblemente, no guardarse
    // a medias y descubrirse semanas después.
    const t = convexTest(schema, convexModules);
    const res = await t.fetch("/leads/upsert", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ manychatId: "mc-1", leadStage: "inventado" }),
    });
    expect(res.status).toBe(400);
  });
});
