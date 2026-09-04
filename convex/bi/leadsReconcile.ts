/**
 * RF-16 — Reconciliación de conteos Airtable ↔ Convex (A71).
 *
 * Es lo único que separa un dual-write vigilado de uno a ciegas. Durante la
 * fase 2 los dos sistemas escriben, y una deriva ahí **no se manifiesta como
 * error**: se manifiesta como un número que dejó de cuadrar y que nadie mira.
 *
 * Corre después de cada sync **full** y contesta tres preguntas:
 *
 *  1. ¿Cuántas filas trajo Airtable y cuántas quedaron vivas en Convex?
 *  2. ¿Qué filas de Convex **ya no están** en Airtable? (`huérfanas`)
 *  3. ¿Cuántas filas **nacieron en Convex**? (`nativas`)
 *
 * La distinción entre 2 y 3 es la que importa y es la que se pierde si uno solo
 * compara totales. Una fila que está en Convex y no en Airtable puede ser:
 *  - **borrada en Airtable** → hay que decidir si se retira acá también, y
 *  - **creada por el bot en Convex** → es exactamente lo que se espera durante
 *    el dual-write, y marcarla como problema sería ruido puro.
 * Se distinguen por `source`, no por corazonada.
 *
 * **Solo full.** En un incremental solo se trajo el delta, así que "no vino en
 * esta corrida" no significa nada. Pedirlo sobre un incremental devuelve
 * `skipped`, no un resultado falso.
 *
 * Cómo se detecta una huérfana: `loadLeadsBatch` toca `updatedAt` en **toda**
 * fila que ve. Entonces, terminado el full, cualquier fila de origen Airtable
 * con `updatedAt` anterior al arranque del sync no vino en el fetch. No hace
 * falta pasar 8,7k identificadores por argumento.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/**
 * Tope de avisos individuales por huérfana.
 *
 * Se emiten con su `airtableId` para que sean accionables (A63: las listas
 * muestran quiénes, no cuántos). Pero si un día el fetch falla a medias y
 * "desaparecen" miles, no queremos 8.000 avisos ahogando el tablero: se cortan
 * acá y el resumen **dice cuántas quedaron fuera**. Truncar en silencio sería
 * el mismo error que estamos tratando de evitar.
 */
const ORPHAN_ISSUE_CAP = 200;

const reconcileResult = v.object({
  skipped: v.boolean(),
  airtableCount: v.number(),
  /** Vivas en Convex, de cualquier origen. */
  convexLive: v.number(),
  /** De origen Airtable y tocadas por esta corrida. */
  seen: v.number(),
  /** De origen Airtable que NO vinieron en el fetch. */
  orphans: v.number(),
  /** Nacidas en Convex (`bot` / `manual`) — esperadas en dual-write. */
  convexNative: v.number(),
  softDeleted: v.number(),
  /** `seen` − (traídas − fallidas). Debería ser 0. */
  delta: v.number(),
  orphanIssues: v.number(),
  orphansNotReported: v.number(),
  status: v.union(v.literal("ok"), v.literal("drift")),
  message: v.string(),
});

export const reconcileLeads = internalMutation({
  args: {
    runId: v.string(),
    /** Momento en que arrancó el sync: el corte para saber qué se tocó. */
    syncStartedAt: v.number(),
    /** Filas traídas de Airtable en esta corrida. */
    airtableCount: v.number(),
    /** Filas que el loader no pudo escribir (ya quedaron como `load_error`). */
    failedRows: v.number(),
    /** `false` en incrementales: no hay nada que reconciliar. */
    isFull: v.boolean(),
  },
  returns: reconcileResult,
  handler: async (
    ctx,
    { runId, syncStartedAt, airtableCount, failedRows, isFull },
  ) => {
    const vacio = {
      skipped: true,
      airtableCount,
      convexLive: 0,
      seen: 0,
      orphans: 0,
      convexNative: 0,
      softDeleted: 0,
      delta: 0,
      orphanIssues: 0,
      orphansNotReported: 0,
      status: "ok" as const,
      message: "incremental: no se reconcilia (solo se trajo el delta)",
    };
    if (!isFull) return vacio;

    let convexLive = 0;
    let seen = 0;
    let convexNative = 0;
    let softDeleted = 0;
    const orphans: Array<Doc<"leads_contacts">> = [];

    for (const lead of await ctx.db.query("leads_contacts").collect()) {
      if (lead.isDeleted) {
        softDeleted++;
        continue;
      }
      convexLive++;

      if (lead.source !== "airtable_migration") {
        // Nació acá. Durante el dual-write esto es lo NORMAL, no una anomalía.
        convexNative++;
        continue;
      }

      if (lead.updatedAt >= syncStartedAt) seen++;
      else orphans.push(lead);
    }

    // Lo que Airtable dijo tener, menos lo que no se pudo escribir.
    const esperadas = airtableCount - failedRows;
    const delta = seen - esperadas;

    /* ------------------------------ avisos -------------------------------- */
    const now = Date.now();
    let orphanIssues = 0;

    for (const lead of orphans.slice(0, ORPHAN_ISSUE_CAP)) {
      await ctx.db.insert("bi_quality_issues", {
        issueType: "lead_orphan",
        severity: "warn",
        entity: "leads_contacts",
        entityRef: lead.airtableId ?? String(lead._id),
        detail:
          "estaba en Convex pero no vino en el sync full: puede haberse " +
          "borrado en Airtable. No se retira automáticamente.",
        runId,
        detectedAt: now,
        resolved: false,
      });
      orphanIssues++;
    }
    const orphansNotReported = Math.max(orphans.length - orphanIssues, 0);

    if (delta !== 0) {
      await ctx.db.insert("bi_quality_issues", {
        issueType: "leads_drift",
        severity: "error",
        entity: "leads_contacts",
        entityRef: runId,
        detail:
          `los conteos no cuadran: Airtable trajo ${airtableCount} ` +
          `(${failedRows} fallidas) y en Convex se tocaron ${seen} — ` +
          `diferencia ${delta > 0 ? "+" : ""}${delta}`,
        runId,
        detectedAt: now,
        resolved: false,
      });
    }

    const status: "ok" | "drift" =
      delta !== 0 || orphans.length > 0 ? "drift" : "ok";
    const message =
      `full: airtable=${airtableCount} vistas=${seen} huérfanas=${orphans.length} ` +
      `nativas=${convexNative} delta=${delta}` +
      (orphansNotReported > 0 ? ` (${orphansNotReported} sin avisar por tope)` : "");

    await setReconcileMeta(ctx, status, convexLive, message);

    return {
      skipped: false,
      airtableCount,
      convexLive,
      seen,
      orphans: orphans.length,
      convexNative,
      softDeleted,
      delta,
      orphanIssues,
      orphansNotReported,
      status,
      message,
    };
  },
});

/** `bi_meta` key `leads_reconcile` — frescura + estado para el tablero (RF-09). */
async function setReconcileMeta(
  ctx: MutationCtx,
  status: "ok" | "drift",
  rowsProcessed: number,
  message: string,
): Promise<void> {
  const existing = await ctx.db
    .query("bi_meta")
    .withIndex("by_key", (q) => q.eq("key", "leads_reconcile"))
    .unique();
  const row = {
    key: "leads_reconcile",
    lastRunAt: Date.now(),
    // `bi_meta.lastStatus` solo admite ok|error. Una deriva NO es un fallo de
    // la corrida —corrió bien y encontró algo—, pero tampoco es "ok": si se
    // guardara como ok, el tablero diría que todo está bien mientras el
    // mensaje cuenta lo contrario. Se guarda como error para que se vea.
    lastStatus: (status === "ok" ? "ok" : "error") as "ok" | "error",
    rowsProcessed,
    message,
  };
  if (existing) await ctx.db.patch(existing._id, row);
  else await ctx.db.insert("bi_meta", row);
}

/** Último resultado de la reconciliación, para el tablero. */
export const reconcileStatus = internalQuery({
  args: {},
  returns: v.union(
    v.object({
      lastRunAt: v.number(),
      lastStatus: v.string(),
      rowsProcessed: v.union(v.number(), v.null()),
      message: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("bi_meta")
      .withIndex("by_key", (q) => q.eq("key", "leads_reconcile"))
      .unique();
    if (!row) return null;
    return {
      lastRunAt: row.lastRunAt,
      lastStatus: row.lastStatus,
      rowsProcessed: row.rowsProcessed ?? null,
      message: row.message ?? null,
    };
  },
});
