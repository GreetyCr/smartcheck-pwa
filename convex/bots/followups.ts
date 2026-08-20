/**
 * Seguimientos vencidos (A37) — reemplaza la fórmula `Horas sin responder`
 * de Airtable y la vista que hoy alimenta el cron de n8n.
 *
 * En Airtable esto es una fórmula recalculada por fila; acá es un rango sobre
 * el índice `by_last_contact`, así que el costo no crece con el tamaño de la
 * tabla sino con la cantidad de leads que efectivamente están vencidos.
 *
 * `internal`: la superficie pública es `GET /leads/due-followups` (§5 handoff).
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalQuery } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Las tres ventanas espejan los checkboxes `Seguimiento 2h/23h/48h` de Airtable.
 *
 * La cadencia está acá y no como parámetro del endpoint a propósito: si n8n
 * mandara las horas, dos flujos mal configurados podrían marcar el mismo flag
 * con cortes distintos y nadie se daría cuenta. El servidor define qué significa
 * "2h" y n8n solo elige cuál pedir.
 *
 * ⏳ Pendiente de que Hans confirme que la cadencia real es 2/23/48 — los nombres
 * de los campos de Airtable lo dicen, pero no lo hemos visto correr.
 */
const WINDOWS = {
  "2h": { hours: 2, flag: "followup2hDone" },
  "23h": { hours: 23, flag: "followup23hDone" },
  "48h": { hours: 48, flag: "followup48hDone" },
} as const;

type WindowKey = keyof typeof WINDOWS;

/** Estados donde un seguimiento ya no tiene sentido (o molesta). */
const TERMINAL_STAGES = new Set(["convertido", "perdido", "expirado"]);

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const dueLeadsReturns = v.object({
  /** Si es `false`, `leads` viene vacío A PROPÓSITO — ver nota abajo. */
  botEnabled: v.boolean(),
  window: v.string(),
  /** Se consideran vencidos los leads con `lastContactAt` <= esto. */
  cutoffAt: v.number(),
  count: v.number(),
  /** `true` si se llegó al tope: volvé a pedir después de marcar los de esta tanda. */
  hasMore: v.boolean(),
  leads: v.array(
    v.object({
      leadId: v.id("leads_contacts"),
      manychatId: v.union(v.string(), v.null()),
      phone8: v.union(v.string(), v.null()),
      name: v.union(v.string(), v.null()),
      lastContactAt: v.number(),
      hoursSinceContact: v.number(),
      leadStage: v.string(),
      paymentStatus: v.union(v.string(), v.null()),
    }),
  ),
});

export const dueFollowups = internalQuery({
  args: {
    window: v.union(v.literal("2h"), v.literal("23h"), v.literal("48h")),
    limit: v.optional(v.number()),
    /** Solo para pruebas: fija el "ahora". En producción no se manda. */
    nowMs: v.optional(v.number()),
  },
  returns: dueLeadsReturns,
  handler: async (ctx, { window, limit, nowMs }) => {
    const spec = WINDOWS[window as WindowKey];
    const now = nowMs ?? Date.now();
    const cutoffAt = now - spec.hours * HOUR_MS;

    /**
     * El kill-switch se aplica ACÁ, en la fuente de la lista, no como un dato
     * informativo que n8n decida respetar o no. Con el bot apagado la respuesta
     * es una lista vacía: no hay a quién escribirle. Un kill-switch que depende
     * de que el consumidor se acuerde de leerlo no es un kill-switch.
     */
    const bot = await ctx.runQuery(internal.bots.settings.getGlobal, {});
    if (!bot.enabled) {
      return {
        botEnabled: false,
        window,
        cutoffAt,
        count: 0,
        hasMore: false,
        leads: [],
      };
    }

    const cap = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const leads: Array<Record<string, unknown>> = [];
    let hasMore = false;

    /**
     * `gt(0)` excluye a los que nunca fueron contactados: en el índice, las filas
     * sin `lastContactAt` ordenan ANTES que cualquier número, así que un `lte`
     * solo se los tragaría a todos. Un lead sin primer contacto no tiene
     * "horas sin responder" — no es un seguimiento vencido, es otro flujo.
     */
    const cursor = ctx.db
      .query("leads_contacts")
      .withIndex("by_last_contact", (q) =>
        q.gt("lastContactAt", 0).lte("lastContactAt", cutoffAt),
      );

    for await (const lead of cursor) {
      if (!isDue(lead, spec.flag)) continue;
      if (leads.length >= cap) {
        hasMore = true;
        break;
      }
      const lastContactAt = lead.lastContactAt as number;
      leads.push({
        leadId: lead._id,
        manychatId: lead.manychatId ?? null,
        phone8: lead.phone8 ?? null,
        name: lead.name ?? null,
        lastContactAt,
        hoursSinceContact:
          Math.round(((now - lastContactAt) / HOUR_MS) * 10) / 10,
        leadStage: lead.leadStage,
        paymentStatus: lead.paymentStatus ?? null,
      });
    }

    return {
      botEnabled: true,
      window,
      cutoffAt,
      count: leads.length,
      hasMore,
      leads: leads as never,
    };
  },
});

/** Un lead entra en la tanda solo si las cuatro condiciones se cumplen. */
function isDue(lead: Doc<"leads_contacts">, flag: string): boolean {
  if (lead.isDeleted) return false;
  // El flag ya marcado es la idempotencia: es lo que evita el doble mensaje.
  if ((lead as unknown as Record<string, unknown>)[flag] === true) return false;
  // On/off por-lead. `undefined` = nunca se configuró → cuenta como encendido,
  // mismo criterio que el default del global (`bots/settings.ts`).
  if (lead.chatbotActive === false) return false;
  if (TERMINAL_STAGES.has(lead.leadStage)) return false;
  return true;
}
