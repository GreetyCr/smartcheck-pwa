/**
 * Superficie pública del on/off del bot — lo que consume el tablero (A28/A37).
 *
 * Las funciones de `settings.ts` son `internal` (blindaje A23); acá van las dos
 * puertas con `requireAdmin`, igual que el resto del BI (A41).
 *
 * **Solo el on/off GLOBAL.** El por-lead (`leads_contacts.chatbotActive`) no se
 * expone todavía: el sync semanal lo pisa cada lunes mientras
 * `CONVEX_OWNS_BOT_FIELDS` esté apagado (A66/A69). Un interruptor que se
 * revierte solo a los pocos días es peor que no tenerlo.
 */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { readGlobalState, writeGlobalState } from "./settings";

const estadoPublico = v.object({
  enabled: v.boolean(),
  updatedAt: v.union(v.number(), v.null()),
  updatedBy: v.union(v.string(), v.null()),
  updatedVia: v.union(v.string(), v.null()),
  note: v.union(v.string(), v.null()),
  isDefault: v.boolean(),
  /**
   * Si la API de bots está abierta, o sea si el interruptor **puede** surtir
   * efecto hoy.
   *
   * Esto es lo que evita que el tablero mienta. Mientras Hans no haya conectado
   * n8n a Convex, apagar el bot desde acá **no apaga nada**: su bot sigue
   * leyendo Airtable. Si la pantalla dijera «bot apagado» sin más, Esteban
   * podría creer que dejó de escribirle a sus clientes cuando no fue así — y esa
   * confusión, en un kill-switch, es exactamente el daño que hay que evitar.
   *
   * Se deriva de si el token de ingesta está configurado en este deployment: sin
   * token, la API responde 500 a todo el mundo y el interruptor es decorativo.
   */
  apiConectada: v.boolean(),
});

export const botStatus = query({
  args: {},
  returns: estadoPublico,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const estado = await readGlobalState(ctx);
    return {
      ...estado,
      apiConectada: !!process.env.N8N_INGEST_TOKEN?.trim(),
    };
  },
});

export const setBotEnabled = mutation({
  args: {
    enabled: v.boolean(),
    /** Por qué se apagó. Se agradece a las 2 a.m. */
    note: v.optional(v.string()),
  },
  returns: estadoPublico,
  handler: async (ctx, { enabled, note }) => {
    const admin = await requireAdmin(ctx);
    const estado = await writeGlobalState(ctx, {
      enabled,
      // Queda el clerkId de quien lo tocó: en un kill-switch, "quién" es la
      // mitad de la respuesta cuando algo salió mal.
      updatedBy: admin.clerkId,
      updatedVia: "dashboard",
      note: note?.trim() || undefined,
    });
    return {
      ...estado,
      apiConectada: !!process.env.N8N_INGEST_TOKEN?.trim(),
    };
  },
});
