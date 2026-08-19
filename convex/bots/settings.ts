/**
 * Kill-switch del bot (A37) — estado global.
 *
 * Espeja la tabla "ON/OFF Chatbot" de Airtable. Es la **fuente única** del on/off
 * una vez que Hans conecte n8n: hoy Airtable manda, después manda esto.
 *
 * Estas funciones son `internal`: la superficie pública son el endpoint HTTP
 * (`/bot/onoff`, para n8n) y las mutations del tablero (para Esteban). Ninguna
 * de las dos toca la tabla directo.
 *
 * ⚠️ Esto es el on/off **GLOBAL**. El on/off **por-lead** vive en
 * `leads_contacts.chatbotActive` y hoy NO es confiable: el sync semanal de
 * Airtable lo pisa todos los lunes (A66). No se expone hasta resolver eso.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const GLOBAL_KEY = "chatbot_global";

/**
 * Qué pasa si no hay fila todavía.
 *
 * Se responde **encendido**. Puede sonar al revés para un kill-switch, pero el
 * bot hoy corre contra Airtable y funciona: si contestáramos "apagado" mientras
 * nadie configuró nada, el día que Hans conecte el bot se detendría solo y el
 * cliente dejaría de recibir respuestas sin que nadie lo haya decidido.
 *
 * O sea: la ausencia de configuración conserva el estado actual, no lo cambia.
 * Apagar el bot tiene que ser siempre un acto explícito de alguien.
 */
const DEFAULT_ENABLED = true;

const botStateReturns = v.object({
  enabled: v.boolean(),
  updatedAt: v.union(v.number(), v.null()),
  updatedBy: v.union(v.string(), v.null()),
  updatedVia: v.union(v.string(), v.null()),
  note: v.union(v.string(), v.null()),
  /** `true` mientras nadie lo haya tocado nunca — se está viendo el default. */
  isDefault: v.boolean(),
});

export const getGlobal = internalQuery({
  args: {},
  returns: botStateReturns,
  handler: async (ctx) => {
    const row = await ctx.db
      .query("bot_settings")
      .withIndex("by_key", (q) => q.eq("key", GLOBAL_KEY))
      .unique();

    if (!row) {
      return {
        enabled: DEFAULT_ENABLED,
        updatedAt: null,
        updatedBy: null,
        updatedVia: null,
        note: null,
        isDefault: true,
      };
    }

    return {
      enabled: row.enabled,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
      updatedVia: row.updatedVia,
      note: row.note ?? null,
      isDefault: false,
    };
  },
});

export const setGlobal = internalMutation({
  args: {
    enabled: v.boolean(),
    updatedBy: v.string(),
    updatedVia: v.union(
      v.literal("dashboard"),
      v.literal("api"),
      v.literal("system"),
    ),
    note: v.optional(v.string()),
  },
  returns: botStateReturns,
  handler: async (ctx, { enabled, updatedBy, updatedVia, note }) => {
    const now = Date.now();
    const row = await ctx.db
      .query("bot_settings")
      .withIndex("by_key", (q) => q.eq("key", GLOBAL_KEY))
      .unique();

    const next = { enabled, updatedAt: now, updatedBy, updatedVia, note };

    /**
     * Conflicto de precedencia (pregunta H2, sin responder).
     *
     * Si el bot revierte por API algo que una persona decidió desde el tablero,
     * eso **no se resuelve solo**: no sabemos todavía quién debe ganar. Lo que
     * sí podemos garantizar es que no pase en silencio — si Esteban apaga el bot
     * y quince minutos después vuelve solo, tiene que quedar rastro de por qué.
     *
     * Se aplica el cambio (no inventamos una política de bloqueo que después
     * haya que deshacer) y se registra el choque.
     */
    if (
      row &&
      updatedVia === "api" &&
      row.updatedVia === "dashboard" &&
      row.enabled !== enabled
    ) {
      await ctx.db.insert("bi_quality_issues", {
        issueType: "onoff_conflict",
        severity: "warn",
        entity: "bot_settings",
        entityRef: GLOBAL_KEY,
        detail:
          `la API puso el bot en ${enabled ? "encendido" : "apagado"}, ` +
          `revirtiendo lo que se había fijado desde el tablero. ` +
          `Precedencia sin definir (H2).`,
        runId: `onoff_${now}`,
        detectedAt: now,
        resolved: false,
      });
    }

    if (row) {
      await ctx.db.patch(row._id, next);
    } else {
      await ctx.db.insert("bot_settings", { key: GLOBAL_KEY, ...next });
    }

    return {
      enabled,
      updatedAt: now,
      updatedBy,
      updatedVia,
      note: note ?? null,
      isDefault: false,
    };
  },
});
