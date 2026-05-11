import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/** Solo para entrega n8n (sin auth de usuario). */
export const inspectionById = internalQuery({
  args: { id: v.id("inspections") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/**
 * Reenvía un snapshot a n8n (HTTP POST). Solo servidor Convex; URL en N8N_WEBHOOK_URL.
 * No afecta latencia de mutaciones: se invoca vía scheduler desde las mutaciones.
 */
export const deliver = internalAction({
  args: {
    event: v.string(),
    inspectionId: v.optional(v.id("inspections")),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const url = process.env.N8N_WEBHOOK_URL?.trim();
    if (!url) return;

    let inspection: unknown = null;
    if (args.inspectionId) {
      inspection = await ctx.runQuery(internal.n8nWebhook.inspectionById, {
        id: args.inspectionId,
      });
    }

    const body = {
      source: "smartcheck-pwa",
      event: args.event,
      at: new Date().toISOString(),
      inspectionId: args.inspectionId ?? null,
      inspection,
      meta: args.meta ?? null,
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("[n8n webhook]", res.status, t.slice(0, 500));
      }
    } catch (e) {
      console.error("[n8n webhook]", e);
    }
  },
});
