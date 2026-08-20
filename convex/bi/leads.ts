/**
 * WP — Carga idempotente del histórico de leads de Airtable ("Vehículos") en
 * `leads_contacts`. Migración inicial 1:1 (DECISIÓN A26): cada registro de
 * Airtable se importa como UNA fila en Convex, idempotente por `airtableId`
 * (`withIndex("by_airtable_id").unique()` → patch/insert). Los duplicados por
 * `phone8`/`manychatId` NO se fusionan: se detectan en el driver y se MARCAN en
 * `bi_quality_issues` (`lead_dup`, info) para curación posterior.
 *
 * Patrón idéntico a `bi/legacy.ts` y `bi/finance.ts` (AGENTS §7.6,
 * MODELO-LEADS-CONTACTS-v2 §2/§3): `internalMutation` por lotes, try/catch por
 * fila (fila mala → `bi_quality_issues` `load_error`, NUNCA aborta el lote ni
 * filtra en silencio), `setMeta`, `resetIssues`, e `internalQuery` de stats.
 *
 * El mapeo campo-Airtable→campo-Convex (MODELO-LEADS-CONTACTS-v2 §3) y la
 * normalización (phone8/phoneValid, enums, fechas → epoch ms) se hacen en el
 * driver de scratchpad y llegan ya resueltos; esta mutation solo valida, upserta
 * y loguea. SOLO DEV en este WP.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/* -------------------------------------------------------------------------- */
/* Enums de dominio (idénticos a schema.ts leads_contacts)                     */
/* -------------------------------------------------------------------------- */

const paymentStatus = v.union(
  v.literal("esperando"),
  v.literal("recibido"),
  v.literal("expirado"),
  v.literal("en_handoff"),
);

const channel = v.union(
  v.literal("publicidad"),
  v.literal("mercadeo"),
  v.literal("tiktok"),
  v.literal("buscador"),
  v.literal("recompra"),
  v.literal("referido"),
  v.literal("otro"),
);

/* -------------------------------------------------------------------------- */
/* Validadores                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Fila ya mapeada por el driver (MODELO-LEADS-CONTACTS-v2 §3). `airtableId` es
 * la llave natural de idempotencia (índice `by_airtable_id`). `dedupKey`,
 * `source`, `isDeleted`, `leadStage`, `createdAt`/`updatedAt` los pone la
 * mutation (no viven en Airtable).
 */
const rawLead = v.object({
  airtableId: v.string(), // "rec…" — llave 1:1 A26
  // identidad / dedup
  manychatId: v.optional(v.string()),
  phone8: v.optional(v.string()),
  phoneValid: v.boolean(),
  rawPhone: v.optional(v.string()),
  // persona (PII)
  name: v.optional(v.string()),
  locality: v.optional(v.string()),
  needsInvoice: v.optional(v.boolean()),
  // vehículo
  vehicleBrand: v.optional(v.string()),
  vehicleModel: v.optional(v.string()),
  vehicleYear: v.optional(v.number()),
  transmissionType: v.optional(v.string()),
  engineType: v.optional(v.string()),
  tractionType: v.optional(v.string()),
  vehicleConditionNote: v.optional(v.string()),
  // ciclo de vida
  paymentStatus: v.optional(paymentStatus),
  channel: v.optional(channel),
  chatbotActive: v.optional(v.boolean()),
  reminders: v.optional(v.string()),
  // cadencia de seguimiento
  followup2hDone: v.optional(v.boolean()),
  followup23hDone: v.optional(v.boolean()),
  followup48hDone: v.optional(v.boolean()),
  auditCompleted: v.optional(v.boolean()),
  sentToSecondTech: v.optional(v.boolean()),
  // timestamps de negocio (epoch ms)
  sourceCreatedAt: v.optional(v.number()),
  lastContactAt: v.optional(v.number()),
  appointmentAt: v.optional(v.number()),
  paymentPendingAt: v.optional(v.number()),
});

const batchResult = v.object({
  received: v.number(),
  inserted: v.number(),
  patched: v.number(),
  failed: v.number(),
  /** Filas donde el sync respetó campos que Convex ya posee (A66). */
  ownedRespected: v.number(),
});

/* -------------------------------------------------------------------------- */
/* Propiedad por campo — A66                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Campos que Convex pasa a POSEER durante el dual-write.
 *
 * El problema que resuelve: el sync semanal hace `patch` de los 27 campos
 * operativos sobre ~8,6k filas. Mientras eso siga así, **Airtable gana siempre**
 * y cualquier escritura de n8n (o del tablero) desaparece el lunes siguiente sin
 * error y sin log. Se ve como si Convex perdiera datos solo.
 *
 * La alternativa era apagar el sync entero, pero eso deja al BI sin leads nuevos
 * y congela el embudo justo después de haberlo puesto en producción. Acá el sync
 * sigue trayendo todo lo demás —altas, nombre, vehículo, canal— y solo suelta lo
 * que el otro lado pasa a mandar.
 *
 * Hay precedente: el sync ya excluye `createdAt` y `leadStage`. Esta lista es la
 * misma idea, más larga.
 *
 * `lastContactAt` está adentro y es fácil de pasar por alto —de hecho se cayó de
 * la primera versión de la lista—: es el campo sobre el que se calculan las
 * ventanas de seguimiento (`GET /leads/due-followups`). Si el lunes se
 * re-escribiera con el valor de Airtable, los cortes de 2/23/48 h se moverían
 * solos y el bot escribiría fuera de tiempo.
 */
const CONVEX_OWNED_ON_PATCH = [
  "chatbotActive",
  "followup2hDone",
  "followup23hDone",
  "followup48hDone",
  "paymentStatus",
  "lastContactAt",
  // `appointmentAt` se sumó después, revisando el handoff contra el código: el
  // bot agenda citas por `/leads/upsert`, así que sin esto una cita puesta el
  // martes volvía al valor de Airtable el lunes. Mismo perfil que
  // `lastContactAt` — lo escribe el bot y se usa para operar.
  "appointmentAt",
] as const;

/**
 * Apagado por defecto: hoy Airtable **sí** es la fuente de esos campos, y
 * soltarlos sin que nadie escriba del otro lado solo congelaría datos buenos. Se
 * enciende con `CONVEX_OWNS_BOT_FIELDS="true"` al arrancar el dual-write, sin
 * redeploy — mismo patrón que `AIRTABLE_SYNC_DISABLED`.
 */
function convexOwnsBotFields(): boolean {
  return process.env.CONVEX_OWNS_BOT_FIELDS === "true";
}

/* -------------------------------------------------------------------------- */
/* Carga idempotente por lotes (import 1:1 por airtableId, A26)               */
/* -------------------------------------------------------------------------- */

export const loadLeadsBatch = internalMutation({
  args: { rows: v.array(rawLead), runId: v.string() },
  returns: batchResult,
  handler: async (ctx, { rows, runId }) => {
    const now = Date.now();
    let inserted = 0;
    let patched = 0;
    let failed = 0;
    let ownedRespected = 0;
    // Se lee una vez por lote, no por fila: que el interruptor cambie a mitad de
    // una corrida dejaría el lote partido con dos criterios distintos.
    const respetarPropiedad = convexOwnsBotFields();

    for (const r of rows) {
      try {
        // dedupKey = COALESCE(manychatId, phone8, "synthetic:"+airtableId) (§2)
        const dedupKey =
          r.manychatId && r.manychatId.length > 0
            ? r.manychatId
            : r.phone8 && r.phone8.length > 0
              ? r.phone8
              : `synthetic:${r.airtableId}`;

        // Campos derivados de Airtable (solo los presentes; el resto queda ausente).
        const mapped = {
          manychatId: r.manychatId,
          phone8: r.phone8,
          phoneValid: r.phoneValid,
          rawPhone: r.rawPhone,
          name: r.name,
          locality: r.locality,
          needsInvoice: r.needsInvoice,
          vehicleBrand: r.vehicleBrand,
          vehicleModel: r.vehicleModel,
          vehicleYear: r.vehicleYear,
          transmissionType: r.transmissionType,
          engineType: r.engineType,
          tractionType: r.tractionType,
          vehicleConditionNote: r.vehicleConditionNote,
          paymentStatus: r.paymentStatus,
          channel: r.channel,
          chatbotActive: r.chatbotActive,
          reminders: r.reminders,
          followup2hDone: r.followup2hDone,
          followup23hDone: r.followup23hDone,
          followup48hDone: r.followup48hDone,
          auditCompleted: r.auditCompleted,
          sentToSecondTech: r.sentToSecondTech,
          sourceCreatedAt: r.sourceCreatedAt,
          lastContactAt: r.lastContactAt,
          appointmentAt: r.appointmentAt,
          paymentPendingAt: r.paymentPendingAt,
          dedupKey,
          source: "airtable_migration" as const,
          airtableId: r.airtableId,
          isDeleted: false,
          updatedAt: now,
        };

        const existing = await ctx.db
          .query("leads_contacts")
          .withIndex("by_airtable_id", (q) =>
            q.eq("airtableId", r.airtableId),
          )
          .unique();

        if (existing) {
          // Import 1:1 idempotente: refresca campos de origen; NO toca
          // `createdAt` (alta en Convex) ni `leadStage` (estado operativo).
          // Y, si Convex ya posee los campos del bot, tampoco esos (A66).
          const patch: Record<string, unknown> = { ...mapped };
          if (respetarPropiedad) {
            for (const campo of CONVEX_OWNED_ON_PATCH) delete patch[campo];
            ownedRespected++;
          }
          await ctx.db.patch(existing._id, patch as never);
          patched++;
        } else {
          // En un alta no hay nada que respetar: la fila todavía no existe en
          // Convex, así que Airtable es su única fuente posible.
          await ctx.db.insert("leads_contacts", {
            ...mapped,
            leadStage: "nuevo" as const, // default; sin equivalente en Airtable (§3)
            createdAt: now,
          });
          inserted++;
        }
      } catch (err) {
        failed++;
        await ctx.db.insert("bi_quality_issues", {
          issueType: "load_error",
          severity: "error",
          entity: "leads_contacts",
          entityRef: r?.airtableId ?? "(sin airtableId)",
          detail: String(err instanceof Error ? err.message : err),
          runId,
          detectedAt: now,
          resolved: false,
        });
      }
    }

    return { received: rows.length, inserted, patched, failed, ownedRespected };
  },
});

/**
 * Persiste los issues precomputados por el driver (duplicados / PSIDs / sin
 * llave / teléfonos anómalos). Tipos: `lead_dup` (info), `lead_no_key` (warn),
 * `anomalous_phone` (info/warn), `unmapped_channel` (info). Nunca en silencio.
 * Idempotente vía `resetLeadIssues` previo.
 */
export const loadLeadIssues = internalMutation({
  args: {
    issues: v.array(
      v.object({
        issueType: v.string(),
        severity: v.union(
          v.literal("info"),
          v.literal("warn"),
          v.literal("error"),
        ),
        entityRef: v.string(),
        detail: v.optional(v.string()),
      }),
    ),
    runId: v.string(),
  },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, { issues, runId }) => {
    const now = Date.now();
    let insertedCount = 0;
    for (const i of issues) {
      await ctx.db.insert("bi_quality_issues", {
        issueType: i.issueType,
        severity: i.severity,
        entity: "leads_contacts",
        entityRef: i.entityRef,
        detail: i.detail,
        runId,
        detectedAt: now,
        resolved: false,
      });
      insertedCount++;
    }
    return { inserted: insertedCount };
  },
});

/** Limpia issues `entity="leads_contacts"` de corridas previas (idempotencia del log). */
export const resetLeadIssues = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("bi_quality_issues").collect();
    let deleted = 0;
    for (const r of rows) {
      if (r.entity === "leads_contacts") {
        await ctx.db.delete(r._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

/** Upsert de `bi_meta` (frescura/estado del proceso, RF-09). key = "leads_migration". */
export const setLeadsMeta = internalMutation({
  args: {
    status: v.union(v.literal("ok"), v.literal("error")),
    rowsProcessed: v.number(),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { status, rowsProcessed, message }) => {
    const existing = await ctx.db
      .query("bi_meta")
      .withIndex("by_key", (q) => q.eq("key", "leads_migration"))
      .unique();
    const doc = {
      key: "leads_migration",
      lastRunAt: Date.now(),
      lastStatus: status,
      rowsProcessed,
      message,
    };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("bi_meta", doc);
    return null;
  },
});

/* -------------------------------------------------------------------------- */
/* Validación                                                                 */
/* -------------------------------------------------------------------------- */

/** Resumen de validación desde DEV: fill-rates, phoneValid, duplicados, enums, rango, issues. */
/* -------------------------------------------------------------------------- */
/* Leads que piden acción (los accionables del tablero de calidad)            */
/* -------------------------------------------------------------------------- */

/** Motivo canónico por el que un teléfono no se pudo usar como llave. */
export function motivoTelefono(detail: string | undefined): string {
  const d = detail ?? "";
  if (d.includes("PSID")) return "psid";
  if (d.includes("no-CR")) return "no_cr";
  if (d.includes("placeholder")) return "placeholder";
  if (d.includes("primer dígito")) return "primer_digito";
  // Dos redacciones distintas para el mismo problema de fondo —el número no da
  // 8 dígitos—: "longitud anómala (N díg)" cuando se truncó, y "no normalizable"
  // cuando no hubo forma. Para Esteban es lo mismo, así que van juntas.
  if (d.includes("longitud") || d.includes("normalizable")) return "longitud";
  return "otro";
}

/** Forma de retorno de los leads accionables — la reusa `bi/public.ts`. */
export const leadsPorRevisarReturns = v.object({
  sinLlave: v.array(
    v.object({
      airtableId: v.string(),
      name: v.optional(v.string()),
      leadStage: v.string(),
      sourceCreatedAt: v.optional(v.number()),
    }),
  ),
  telefonoRaro: v.array(
    v.object({
      airtableId: v.string(),
      name: v.optional(v.string()),
      rawPhone: v.optional(v.string()),
      /** psid | no_cr | placeholder | primer_digito | longitud | otro */
      motivo: v.string(),
      sourceCreatedAt: v.optional(v.number()),
    }),
  ),
});

/**
 * Los leads que SÍ piden acción, con lo necesario para actuar sobre ellos.
 *
 * El tablero mostraba conteos (31 sin llave, 152 con teléfono raro) y ahí se
 * acababa: Esteban veía el número pero no podía hacer nada con él. Esto devuelve
 * **quiénes son**, con el `airtableId` para que pueda ir a buscarlos en Airtable,
 * que es donde los va a corregir mientras Airtable siga siendo la fuente.
 *
 * Deliberadamente NO incluye `lead_dup`: son ruido esperado por diseño (A26) y
 * meterlos acá volvería inútil la lista, que es justo lo que se quiere evitar.
 */
export async function leadsPorRevisarImpl(ctx: QueryCtx) {
  const issues = (await ctx.db.query("bi_quality_issues").collect()).filter(
    (i) => i.entity === "leads_contacts" && !i.resolved,
  );
  const leads = await ctx.db.query("leads_contacts").collect();
  const porAirtableId = new Map<string, Doc<"leads_contacts">>();
  for (const l of leads) if (l.airtableId) porAirtableId.set(l.airtableId, l);

  const base = (ref: string) => {
    const l = porAirtableId.get(ref);
    return {
      airtableId: ref,
      name: l?.name,
      sourceCreatedAt: l?.sourceCreatedAt,
      lead: l,
    };
  };

  const sinLlave = issues
    .filter((i) => i.issueType === "lead_no_key")
    .map((i) => {
      const b = base(i.entityRef);
      return {
        airtableId: b.airtableId,
        name: b.name,
        leadStage: b.lead?.leadStage ?? "desconocido",
        sourceCreatedAt: b.sourceCreatedAt,
      };
    });

  const telefonoRaro = issues
    .filter((i) => i.issueType === "anomalous_phone")
    .map((i) => {
      const b = base(i.entityRef);
      return {
        airtableId: b.airtableId,
        name: b.name,
        rawPhone: b.lead?.rawPhone,
        motivo: motivoTelefono(i.detail),
        sourceCreatedAt: b.sourceCreatedAt,
      };
    });

  const recientes = <T extends { sourceCreatedAt?: number }>(a: T, b: T) =>
    (b.sourceCreatedAt ?? 0) - (a.sourceCreatedAt ?? 0);

  return {
    sinLlave: sinLlave.sort(recientes),
    telefonoRaro: telefonoRaro.sort(recientes),
  };
}

export const leadsPorRevisar = internalQuery({
  args: {},
  returns: leadsPorRevisarReturns,
  handler: async (ctx) => leadsPorRevisarImpl(ctx),
});

/** Forma de retorno de las stats de leads — la reusa el wrapper público (`bi/public.ts`). */
export const leadsStatsReturns = v.object({
    total: v.number(),
    isDeleted: v.number(),
    phone8Present: v.number(),
    manychatPresent: v.number(),
    namePresent: v.number(),
    phoneValidTrue: v.number(),
    phoneValidFalse: v.number(),
    dupPhone8Groups: v.number(),
    dupPhone8ExcessRows: v.number(),
    dupManychatGroups: v.number(),
    dupManychatExcessRows: v.number(),
    minSourceCreatedAt: v.number(),
    maxSourceCreatedAt: v.number(),
    sourceCreatedPresent: v.number(),
    byStage: v.array(v.object({ stage: v.string(), rows: v.number() })),
    byChannel: v.array(v.object({ channel: v.string(), rows: v.number() })),
    issuesByType: v.array(
      v.object({ issueType: v.string(), rows: v.number() }),
    ),
});

export const leadsStats = internalQuery({
  args: {},
  returns: leadsStatsReturns,
  handler: async (ctx) => leadsStatsImpl(ctx),
});

/** Stats de calidad de leads, plano y compartido (ver A41 en `bi/metrics.ts`). */
export async function leadsStatsImpl(ctx: QueryCtx) {
    const rows = await ctx.db.query("leads_contacts").collect();
    let isDeleted = 0,
      phone8Present = 0,
      manychatPresent = 0,
      namePresent = 0,
      phoneValidTrue = 0,
      phoneValidFalse = 0,
      sourceCreatedPresent = 0;
    let minSourceCreatedAt = Number.POSITIVE_INFINITY,
      maxSourceCreatedAt = 0;
    const phone8Counts = new Map<string, number>();
    const manychatCounts = new Map<string, number>();
    const byStage = new Map<string, number>();
    const byChannel = new Map<string, number>();

    for (const r of rows) {
      if (r.isDeleted) isDeleted++;
      if (r.phone8) {
        phone8Present++;
        phone8Counts.set(r.phone8, (phone8Counts.get(r.phone8) ?? 0) + 1);
      }
      if (r.manychatId) {
        manychatPresent++;
        manychatCounts.set(
          r.manychatId,
          (manychatCounts.get(r.manychatId) ?? 0) + 1,
        );
      }
      if (r.name) namePresent++;
      if (r.phoneValid) phoneValidTrue++;
      else phoneValidFalse++;
      if (r.sourceCreatedAt !== undefined) {
        sourceCreatedPresent++;
        if (r.sourceCreatedAt < minSourceCreatedAt)
          minSourceCreatedAt = r.sourceCreatedAt;
        if (r.sourceCreatedAt > maxSourceCreatedAt)
          maxSourceCreatedAt = r.sourceCreatedAt;
      }
      byStage.set(r.leadStage, (byStage.get(r.leadStage) ?? 0) + 1);
      const ch = r.channel ?? "(vacío)";
      byChannel.set(ch, (byChannel.get(ch) ?? 0) + 1);
    }

    let dupPhone8Groups = 0,
      dupPhone8ExcessRows = 0;
    for (const c of phone8Counts.values()) {
      if (c > 1) {
        dupPhone8Groups++;
        dupPhone8ExcessRows += c - 1;
      }
    }
    let dupManychatGroups = 0,
      dupManychatExcessRows = 0;
    for (const c of manychatCounts.values()) {
      if (c > 1) {
        dupManychatGroups++;
        dupManychatExcessRows += c - 1;
      }
    }

    const issues = await ctx.db.query("bi_quality_issues").collect();
    const issueCounts = new Map<string, number>();
    for (const it of issues) {
      if (it.entity !== "leads_contacts") continue;
      issueCounts.set(it.issueType, (issueCounts.get(it.issueType) ?? 0) + 1);
    }

    return {
      total: rows.length,
      isDeleted,
      phone8Present,
      manychatPresent,
      namePresent,
      phoneValidTrue,
      phoneValidFalse,
      dupPhone8Groups,
      dupPhone8ExcessRows,
      dupManychatGroups,
      dupManychatExcessRows,
      minSourceCreatedAt: Number.isFinite(minSourceCreatedAt)
        ? minSourceCreatedAt
        : 0,
      maxSourceCreatedAt,
      sourceCreatedPresent,
      byStage: [...byStage.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([stage, rows]) => ({ stage, rows })),
      byChannel: [...byChannel.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([channel, rows]) => ({ channel, rows })),
      issuesByType: [...issueCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([issueType, rows]) => ({ issueType, rows })),
    };
}
