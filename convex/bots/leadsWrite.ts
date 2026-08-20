/**
 * Escrituras puntuales sobre un lead ya existente (A37):
 * `POST /leads/payment-status` y `POST /leads/mark-followup`.
 *
 * A diferencia de `/leads/upsert`, estos **nunca crean**. Un estado de pago o un
 * seguimiento sobre un contacto que no existe es señal de que algo viene mal más
 * arriba —una llave equivocada, un flujo desincronizado—, no una razón para
 * inventar una ficha. Responden `found: false` y el endpoint devuelve 404.
 *
 * Los dos resuelven la identidad con el **mismo** helper que el upsert: si cada
 * uno buscara a su manera, el bot podría marcar el seguimiento de una persona y
 * escribirle a otra.
 */
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { avisarAmbiguedad, resolverIdentidad, telefonoUtilizable } from "./identity";

const identidadArgs = {
  manychatId: v.optional(v.string()),
  phone: v.optional(v.string()),
  runId: v.optional(v.string()),
};

const paymentStatus = v.union(
  v.literal("esperando"),
  v.literal("recibido"),
  v.literal("expirado"),
  v.literal("en_handoff"),
);

/** Las tres ventanas espejan los checkboxes `Seguimiento 2h/23h/48h` de Airtable. */
const FLAGS = {
  "2h": "followup2hDone",
  "23h": "followup23hDone",
  "48h": "followup48hDone",
} as const;

/* -------------------------------------------------------------------------- */
/* POST /leads/payment-status                                                  */
/* -------------------------------------------------------------------------- */

export const setPaymentStatus = internalMutation({
  args: { ...identidadArgs, status: paymentStatus },
  returns: v.object({
    found: v.boolean(),
    leadId: v.optional(v.id("leads_contacts")),
    matchedBy: v.string(),
    ambiguous: v.boolean(),
    /** Estado anterior, o `null` si no tenía. Útil para auditar la transición. */
    previous: v.union(v.string(), v.null()),
    current: v.string(),
    /** `false` si ya estaba en ese estado: la llamada fue un no-op. */
    changed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const runId = args.runId ?? `payment_${now}`;
    const { phone8 } = telefonoUtilizable(args.phone);

    const { existing, matchedBy, candidates } = await resolverIdentidad(ctx, {
      manychatId: args.manychatId?.trim() || undefined,
      phone8,
    });

    if (!existing) {
      return {
        found: false,
        matchedBy,
        ambiguous: false,
        previous: null,
        current: args.status,
        changed: false,
      };
    }

    const ambiguous = candidates > 1;
    if (ambiguous) {
      await avisarAmbiguedad(ctx, { lead: existing, matchedBy, candidates, runId, now });
    }

    const previous = existing.paymentStatus ?? null;
    const changed = previous !== args.status;
    // Se patchea aunque no cambie: `updatedAt` fresco documenta que el bot
    // sigue vivo sobre este lead, y hace idempotente el reintento de n8n.
    await ctx.db.patch(existing._id, {
      paymentStatus: args.status,
      updatedAt: now,
    });

    return {
      found: true,
      leadId: existing._id,
      matchedBy,
      ambiguous,
      previous,
      current: args.status,
      changed,
    };
  },
});

/* -------------------------------------------------------------------------- */
/* POST /leads/mark-followup                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Marca (o desmarca) la bandera de una ventana de seguimiento.
 *
 * **Esta es LA pieza que evita el doble mensaje**, así que el contrato es de
 * *reclamo*, no de registro: `claimed` dice si **esta** llamada fue la que puso
 * la bandera en `true`.
 *
 * Recomendación para el flujo de n8n: llamar **ANTES** de enviar y mandar el
 * mensaje solo si `claimed === true`. Marcar después de enviar deja una ventana
 * —si el flujo se cae entre el envío y la marca— donde el reintento vuelve a
 * escribirle al cliente. Marcar antes convierte esa carrera en, como mucho, un
 * mensaje que no se manda; que es el error barato de los dos.
 *
 * *(Hoy en Airtable se marca después. Cambiarlo es decisión de Hans — H3.)*
 */
export const markFollowup = internalMutation({
  args: {
    ...identidadArgs,
    window: v.union(v.literal("2h"), v.literal("23h"), v.literal("48h")),
    /** `false` para liberar la bandera (reintentos manuales, corrección). */
    done: v.optional(v.boolean()),
  },
  returns: v.object({
    found: v.boolean(),
    leadId: v.optional(v.id("leads_contacts")),
    matchedBy: v.string(),
    ambiguous: v.boolean(),
    window: v.string(),
    /** Cómo estaba la bandera antes. */
    previous: v.boolean(),
    /** `true` solo si ESTA llamada la pasó de `false` a `true`. */
    claimed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const runId = args.runId ?? `followup_${now}`;
    const done = args.done ?? true;
    const flag = FLAGS[args.window];
    const { phone8 } = telefonoUtilizable(args.phone);

    const { existing, matchedBy, candidates } = await resolverIdentidad(ctx, {
      manychatId: args.manychatId?.trim() || undefined,
      phone8,
    });

    if (!existing) {
      return {
        found: false,
        matchedBy,
        ambiguous: false,
        window: args.window,
        previous: false,
        claimed: false,
      };
    }

    const ambiguous = candidates > 1;
    if (ambiguous) {
      await avisarAmbiguedad(ctx, { lead: existing, matchedBy, candidates, runId, now });
    }

    const previous =
      (existing as unknown as Record<string, unknown>)[flag] === true;
    // El reclamo solo lo gana quien la pasa de `false` a `true`.
    const claimed = done && !previous;

    await ctx.db.patch(existing._id, { [flag]: done, updatedAt: now } as never);

    return {
      found: true,
      leadId: existing._id,
      matchedBy,
      ambiguous,
      window: args.window,
      previous,
      claimed,
    };
  },
});
