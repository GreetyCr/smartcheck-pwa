/**
 * `POST /leads/upsert` (A37) — la puerta de entrada de n8n / ManyChat a Convex.
 *
 * Reemplaza el "crear o actualizar contacto" que hoy el bot hace sobre Airtable.
 * Es el único endpoint con sustancia real: los otros tres de escritura son
 * patches de un campo sobre una fila ya identificada.
 *
 * Tres cosas que definen su comportamiento y conviene tener presentes:
 *
 * 1. **La llave autoritativa todavía no está decidida** (pregunta H1 a Hans).
 *    Va como constante ordenada `IDENTITY_ORDER`: cuando conteste, cambiar la
 *    decisión es reordenar una lista y correr las pruebas. No se espera por eso.
 *
 * 2. **La identidad no es única y lo sabemos**: 476 grupos de teléfono repetido
 *    y 371 de ManyChat (A26). Cuando una llave matchea varias filas NO se elige
 *    en silencio: se elige de forma determinista **y queda el aviso** con los
 *    candidatos. Un match ambiguo resuelto calladamente parte conversaciones
 *    vivas y nadie se entera hasta que el cliente reclama.
 *
 * 3. **Nunca cambia el `source` de una fila existente.** Si el bot actualiza un
 *    lead que vino de Airtable, la fila sigue siendo `airtable_migration`. Es
 *    lo que permite que la reconciliación (A73) siga sabiendo que Airtable
 *    debería seguir mandándola; marcarla como `bot` la volvería "nativa" y la
 *    sacaría del control de huérfanas sin que nadie lo pidiera.
 */
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  avisarAmbiguedad,
  resolverIdentidad,
  telefonoUtilizable,
} from "./identity";

const paymentStatus = v.union(
  v.literal("esperando"),
  v.literal("recibido"),
  v.literal("expirado"),
  v.literal("en_handoff"),
);

/**
 * Estados que el bot **sí** puede declarar.
 *
 * `convertido` NO está: la conversión se deriva de `bi_matches` —una inspección
 * real con ingreso válido— y no de lo que diga un flujo de n8n. Si el bot
 * pudiera declararla, el embudo dejaría de medir la realidad y pasaría a medir
 * el optimismo del bot.
 */
const declarableStage = v.union(
  v.literal("nuevo"),
  v.literal("contactado"),
  v.literal("en_seguimiento"),
  v.literal("agendado"),
  v.literal("perdido"),
  v.literal("expirado"),
);

const upsertResult = v.object({
  action: v.union(v.literal("created"), v.literal("updated")),
  leadId: v.id("leads_contacts"),
  dedupKey: v.string(),
  /** Con qué llave se resolvió: `manychatId`, `phone8` o `none` en un alta. */
  matchedBy: v.string(),
  /** `true` si la llave apuntaba a más de una fila viva. Queda avisado. */
  ambiguous: v.boolean(),
  /** Cuántas filas competían, cuando hubo ambigüedad. */
  candidates: v.number(),
  /** El teléfono llegó pero no se pudo normalizar a 8 dígitos de CR. */
  phoneRejected: v.boolean(),
  /** Llegó un `manychatId` distinto al guardado: se conservó el existente. */
  identityConflict: v.boolean(),
});

export const upsertLead = internalMutation({
  args: {
    // Identidad
    manychatId: v.optional(v.string()),
    /** Teléfono crudo, como venga: se normaliza acá igual que en el sync. */
    phone: v.optional(v.string()),
    // Persona / vehículo
    name: v.optional(v.string()),
    locality: v.optional(v.string()),
    needsInvoice: v.optional(v.boolean()),
    vehicleBrand: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    vehicleYear: v.optional(v.number()),
    transmissionType: v.optional(v.string()),
    engineType: v.optional(v.string()),
    tractionType: v.optional(v.string()),
    // Estado operativo
    leadStage: v.optional(declarableStage),
    paymentStatus: v.optional(paymentStatus),
    chatbotActive: v.optional(v.boolean()),
    lastContactAt: v.optional(v.number()),
    appointmentAt: v.optional(v.number()),
    followup2hDone: v.optional(v.boolean()),
    followup23hDone: v.optional(v.boolean()),
    followup48hDone: v.optional(v.boolean()),
    /** Traza de la corrida de n8n, para poder seguir un problema hasta su origen. */
    runId: v.optional(v.string()),
  },
  returns: upsertResult,
  handler: async (ctx, args) => {
    const now = Date.now();
    const runId = args.runId ?? `upsert_${now}`;

    /* --------------------------- normalización --------------------------- */
    const manychatId = args.manychatId?.trim() || undefined;
    // El criterio de "teléfono utilizable como llave" es compartido y más
    // estricto que el del sync — ver `identity.ts` (A75).
    const { tel, phone8, rechazado: phoneRejected } = telefonoUtilizable(args.phone);

    if (!manychatId && !phone8) {
      // Sin ninguna llave la fila nace huérfana — ya tenemos 31 así y son
      // justamente las que nadie puede volver a encontrar. Se rechaza.
      throw new Error(
        "Se requiere `manychatId` o un `phone` normalizable a 8 dígitos de Costa Rica.",
      );
    }

    /* ------------------------ resolución de identidad --------------------- */
    const { existing, matchedBy, candidates } = await resolverIdentidad(ctx, {
      manychatId,
      phone8,
    });

    /* ------------------------------ ambigüedad ---------------------------- */
    const ambiguous = candidates > 1;
    if (ambiguous && existing) {
      await avisarAmbiguedad(ctx, { lead: existing, matchedBy, candidates, runId, now });
    }

    // Un teléfono descartado se avisa. El upsert sigue —hay `manychatId`, si no
    // habría fallado arriba— pero ese lead queda sin llave telefónica, o sea sin
    // forma de empatarlo con una inspección. Es dato que alguien puede corregir.
    if (phoneRejected) {
      await ctx.db.insert("bi_quality_issues", {
        issueType: "anomalous_phone",
        severity: "warn",
        entity: "leads_contacts",
        entityRef: manychatId ?? "(sin manychatId)",
        detail:
          `el upsert trajo un teléfono que no es de Costa Rica o no se pudo ` +
          `normalizar; se guardó el crudo pero NO se usa como llave: ` +
          `${tel?.issue?.detail ?? "sin detalle"}`,
        runId,
        detectedAt: now,
        resolved: false,
      });
    }

    /* ------------------------------- escritura ---------------------------- */
    // Solo lo que vino en la llamada. Un upsert parcial NO debe borrar lo que
    // no menciona: n8n manda el pedazo que cambió, no la fila completa.
    const cambios: Record<string, unknown> = { updatedAt: now };
    const asignar = (campo: string, valor: unknown) => {
      if (valor !== undefined) cambios[campo] = valor;
    };

    asignar("manychatId", manychatId);
    if (tel) {
      // El crudo se guarda siempre (auditable); el `phone8` solo si sirve.
      asignar("rawPhone", tel.rawPhone);
      if (phone8) cambios.phone8 = phone8;
      cambios.phoneValid = tel.phoneValid;
    }
    asignar("name", args.name?.trim() || undefined);
    asignar("locality", args.locality?.trim() || undefined);
    asignar("needsInvoice", args.needsInvoice);
    asignar("vehicleBrand", args.vehicleBrand?.trim() || undefined);
    asignar("vehicleModel", args.vehicleModel?.trim() || undefined);
    asignar("vehicleYear", args.vehicleYear);
    asignar("transmissionType", args.transmissionType);
    asignar("engineType", args.engineType);
    asignar("tractionType", args.tractionType);
    asignar("leadStage", args.leadStage);
    asignar("paymentStatus", args.paymentStatus);
    asignar("chatbotActive", args.chatbotActive);
    asignar("lastContactAt", args.lastContactAt);
    asignar("appointmentAt", args.appointmentAt);
    asignar("followup2hDone", args.followup2hDone);
    asignar("followup23hDone", args.followup23hDone);
    asignar("followup48hDone", args.followup48hDone);

    if (existing) {
      /**
       * Un match por teléfono NO puede reasignar la identidad de ManyChat.
       *
       * Si la fila ya tiene un `manychatId` y llega otro distinto habiendo
       * matcheado solo por `phone8`, eso no es una actualización: es un
       * conflicto. Con 476 grupos de teléfono repetido —familias, negocios,
       * números reusados— pisarlo en silencio reasigna la conversación de una
       * persona a otra, y el bot termina contestándole a quien no era.
       *
       * Se conserva el que estaba, se aplica el resto del upsert, y queda el
       * aviso. Resolverlo de verdad es la pregunta H1 (llave autoritativa).
       */
      const conflictoDeIdentidad =
        matchedBy === "phone8" &&
        !!manychatId &&
        !!existing.manychatId &&
        existing.manychatId !== manychatId;

      if (conflictoDeIdentidad) {
        delete cambios.manychatId;
        await ctx.db.insert("bi_quality_issues", {
          issueType: "identity_conflict",
          severity: "warn",
          entity: "leads_contacts",
          entityRef: existing.airtableId ?? String(existing._id),
          detail:
            `upsert por teléfono con un manychatId distinto al guardado; ` +
            `se conservó el existente. Un match por teléfono no reasigna la ` +
            `identidad de ManyChat.`,
          runId,
          detectedAt: now,
          resolved: false,
        });
      }

      // `source` NO se toca: si vino de Airtable, sigue siendo de Airtable.
      // Es lo que mantiene honesta la reconciliación de huérfanas (A73).
      await ctx.db.patch(existing._id, cambios as never);
      return {
        action: "updated" as const,
        leadId: existing._id,
        dedupKey: existing.dedupKey,
        matchedBy,
        ambiguous,
        candidates,
        phoneRejected,
        identityConflict: conflictoDeIdentidad,
      };
    }

    const dedupKey = manychatId ?? phone8!;
    const leadId: Id<"leads_contacts"> = await ctx.db.insert("leads_contacts", {
      dedupKey,
      phoneValid: tel?.phoneValid ?? false,
      leadStage: args.leadStage ?? "nuevo",
      source: "bot",
      isDeleted: false,
      createdAt: now,
      ...cambios,
    } as never);

    return {
      action: "created" as const,
      leadId,
      dedupKey,
      matchedBy: "none",
      ambiguous: false,
      candidates: 0,
      phoneRejected,
      identityConflict: false,
    };
  },
});

