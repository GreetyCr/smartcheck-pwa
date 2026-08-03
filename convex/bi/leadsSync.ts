/**
 * Sync Convex-native de leads: Airtable "Vehículos" → `leads_contacts` (A35).
 *
 * INTERINO: corre mientras Airtable siga vivo captando leads (bots N8N/ManyChat).
 * Se RETIRA en el cutover a full-Convex (cuando los bots escriban directo a
 * Convex vía Hans). Apagable sin tocar código con `AIRTABLE_SYNC_DISABLED="true"`.
 *
 * `syncLeadsFromAirtable({mode})` — `internalAction`:
 *   - Lee `AIRTABLE_PAT` (env, read-only). Trae de la REST API de Airtable con
 *     `returnFieldsByFieldId=true` → mismos field IDs que la migración inicial
 *     (mapeo idéntico → upsert idempotente por `airtableId`, A26).
 *   - `mode:"full"`  → trae todo + reset/recompute de issues (dedup global correcto).
 *   - `mode:"incremental"` → solo registros modificados desde el último sync
 *     (`LAST_MODIFIED_TIME()`); NO recomputa issues (los refresca el full semanal).
 *   - Reusa `bi/leads:{loadLeadsBatch,loadLeadIssues,resetLeadIssues}`.
 *
 * Cron semanal = full (barato: ~8,4k filas). `refreshLeadsNow` (botón F4) = incremental.
 * Airtable SOLO LECTURA. `inspections` operativa intacta.
 */
import { v } from "convex/values";
import {
  mutation,
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import type { FunctionArgs } from "convex/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";

const AIRTABLE_BASE = "appdMLGTpFueaSABj";
const AIRTABLE_TABLE = "tblepqs9U8UmiqN6O";

/* -------- Field IDs (idénticos al driver de migración, MODELO §3) --------- */
const F: Record<string, string> = {
  whatsapp: "fld645IW8zNiiRTjB",
  manychat: "fldJrHWPzlCqM2sK9",
  nombre: "fldtfNJJDg3Wo9ULY",
  chatbot: "fldrlL5RFISX3AJ78",
  estadoPago: "fldZg4hzdkvxL05v8",
  pendientePago: "fldUBY9hkTWHx3l2V",
  marca: "fldYRCknfWr8CUQn1",
  modelo: "fldP90DBQ7DJGBgAl",
  anio: "fldxx1ZTuASlPZBJL",
  localidad: "fldo0wTi4yIDt13CL",
  recordatorios: "fld2JGANYEaX7YnWn",
  necesitaFactura: "fldc4y2720biO2tfi",
  ultimoContacto: "fldodvpuxOdKZNJrI",
  seg2h: "fldohW9AhMTQWFsDx",
  seg23h: "fld6X7CgTnkEOUtyr",
  seg48h: "fldpSeB7K6vcHxvwF",
  transmision: "fld454YucwsY1EEtT",
  motor: "fldgC0ko4UPVbwc0R",
  traccion: "fldLoXNUAEKq2KMLJ",
  origen: "fldcmQDWIiGhWKnOr",
  estadoVehiculo: "fldMZ7JYJM2jxMwUl",
  revision: "fldfDkdNczorGvVeq",
  fuente: "fldWucaEMVusHllMB",
  auditoria: "fldld14eG9bZRQp0L",
  segundoTecnico: "fldtgTCqYoMjopzMg",
};

/* ------------------------------ Normalizadores ---------------------------- */
const str = (val: any): string | undefined => {
  if (val == null) return undefined;
  const s = String(val).trim();
  return s.length ? s : undefined;
};
const cb = (val: any): boolean => val === true;
const num = (val: any): number | undefined =>
  typeof val === "number" && Number.isFinite(val) ? val : undefined;
const dateMs = (val: any): number | undefined => {
  if (val == null) return undefined;
  const ms = Date.parse(String(val));
  return Number.isNaN(ms) ? undefined : ms;
};
/** singleSelect: REST devuelve string; MCP devolvía {name}. Soporta ambos. */
const selName = (val: any): string =>
  typeof val === "string" ? val : val && val.name ? String(val.name) : "";

function mapPaymentStatus(sel: any): string | undefined {
  const n = selName(sel).trim().toLowerCase();
  const m: Record<string, string> = {
    esperando: "esperando",
    recibido: "recibido",
    expirado: "expirado",
    "en handoff": "en_handoff",
    en_handoff: "en_handoff",
  };
  return m[n];
}
function mapChatbot(sel: any): boolean | undefined {
  const n = selName(sel).trim().toLowerCase();
  if (n === "encendido") return true;
  if (n === "apagado") return false;
  return undefined;
}
const CHANNEL_VOCAB: Record<string, string> = {
  publicidad: "mercadeo",
  mercadeo: "mercadeo",
  tiktok: "tiktok",
  "tik tok": "tiktok",
  buscador: "buscador",
  recompra: "recompra",
  referido: "referido",
};
function mapChannel(fuente: any, origen: any): { channel?: string; issue: any } {
  const raw = str(fuente) ?? str(origen);
  if (!raw) return { channel: undefined, issue: null };
  const key = raw.trim().toLowerCase();
  if (CHANNEL_VOCAB[key]) return { channel: CHANNEL_VOCAB[key], issue: null };
  return {
    channel: "otro",
    issue: {
      type: "unmapped_channel",
      sev: "info",
      detail: `canal fuera de vocabulario: "${raw}" → otro`,
    },
  };
}

/** Normaliza teléfono (limpia `+`/`+506`/espacios/invisibles → solo dígitos). */
function normalizePhone(raw: any): {
  rawPhone?: string;
  phone8?: string;
  phoneValid: boolean;
  issue: any;
} {
  const rawPhone = str(raw);
  if (rawPhone === undefined)
    return { rawPhone: undefined, phone8: undefined, phoneValid: false, issue: null };
  const digits = rawPhone.replace(/[^0-9]/g, "");
  if (digits.length === 0)
    return { rawPhone, phone8: undefined, phoneValid: false, issue: null };
  // PSID Messenger/IG (12-15 díg): no es teléfono.
  if (digits.length >= 12) {
    return {
      rawPhone,
      phone8: undefined,
      phoneValid: false,
      issue: {
        type: "anomalous_phone",
        sev: "info",
        detail: `PSID/no-teléfono (${digits.length} díg, Messenger/IG)`,
      },
    };
  }
  let core: string;
  let cr = false,
    nonCR = false,
    oddLen = false;
  if (digits.length === 11 && digits.startsWith("506")) {
    core = digits.slice(3);
    cr = true;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    core = digits.slice(-8);
    nonCR = true;
  } else if (digits.length === 11) {
    core = digits.slice(-8);
    nonCR = true;
  } else if (digits.length === 8) {
    core = digits;
    cr = true;
  } else {
    core = digits.slice(-8);
    oddLen = true;
  }
  const phone8 = core.length === 8 ? core : undefined;
  const placeholder = phone8 ? /^(\d)\1{7}$/.test(phone8) : false;
  const crFirstOk = phone8 ? /^[2-8]/.test(phone8) : false;
  let phoneValid = false;
  let issue: any = null;
  if (!phone8) {
    issue = { type: "anomalous_phone", sev: "warn", detail: `no normalizable a 8 díg (${digits.length} díg)` };
  } else if (placeholder) {
    issue = { type: "anomalous_phone", sev: "warn", detail: `placeholder ${phone8}` };
  } else if (nonCR) {
    issue = { type: "anomalous_phone", sev: "info", detail: `teléfono no-CR (prefijo internacional, ${digits.length} díg)` };
  } else if (oddLen) {
    issue = { type: "anomalous_phone", sev: "warn", detail: `longitud anómala (${digits.length} díg)` };
  } else if (cr && !crFirstOk) {
    issue = { type: "anomalous_phone", sev: "warn", detail: `primer dígito CR inválido (${phone8})` };
  } else {
    phoneValid = true;
  }
  return { rawPhone, phone8, phoneValid, issue };
}

/** Mapea un record de la REST API (`{id, createdTime, fields}`) a la fila rawLead. */
function mapRecord(rec: any): { row: Record<string, any>; phoneIssue: any; channelIssue: any } {
  const c = rec.fields || {};
  const { rawPhone, phone8, phoneValid, issue: phoneIssue } = normalizePhone(c[F.whatsapp]);
  const { channel, issue: channelIssue } = mapChannel(c[F.fuente], c[F.origen]);
  const yr = num(c[F.anio]);
  const vehicleYear = yr !== undefined && yr > 1900 && yr <= 2100 ? yr : undefined;
  const row: Record<string, any> = {
    airtableId: rec.id,
    manychatId: str(c[F.manychat]),
    phone8,
    phoneValid,
    rawPhone,
    name: str(c[F.nombre]),
    locality: str(c[F.localidad]),
    needsInvoice: cb(c[F.necesitaFactura]),
    vehicleBrand: str(c[F.marca]),
    vehicleModel: str(c[F.modelo]),
    vehicleYear,
    transmissionType: str(c[F.transmision]),
    engineType: str(c[F.motor]),
    tractionType: str(c[F.traccion]),
    vehicleConditionNote: str(c[F.estadoVehiculo]),
    paymentStatus: mapPaymentStatus(c[F.estadoPago]),
    channel,
    chatbotActive: mapChatbot(c[F.chatbot]),
    reminders: str(c[F.recordatorios]),
    followup2hDone: cb(c[F.seg2h]),
    followup23hDone: cb(c[F.seg23h]),
    followup48hDone: cb(c[F.seg48h]),
    auditCompleted: cb(c[F.auditoria]),
    sentToSecondTech: cb(c[F.segundoTecnico]),
    sourceCreatedAt: dateMs(rec.createdTime),
    lastContactAt: dateMs(c[F.ultimoContacto]),
    appointmentAt: dateMs(c[F.revision]),
    paymentPendingAt: dateMs(c[F.pendientePago]),
  };
  for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
  return { row, phoneIssue, channelIssue };
}

type Issue = { issueType: string; severity: "info" | "warn" | "error"; entityRef: string; detail: string };

/** Issues por-fila (phone/channel/sin-llave). Siempre; no dependen del dataset completo. */
function perRowIssues(mapped: Array<ReturnType<typeof mapRecord>>): Issue[] {
  const issues: Issue[] = [];
  for (const { row, phoneIssue, channelIssue } of mapped) {
    if (phoneIssue)
      issues.push({ issueType: phoneIssue.type, severity: phoneIssue.sev, entityRef: row.airtableId, detail: phoneIssue.detail });
    if (channelIssue)
      issues.push({ issueType: channelIssue.type, severity: channelIssue.sev, entityRef: row.airtableId, detail: channelIssue.detail });
    if (!row.manychatId && !row.phone8)
      issues.push({ issueType: "lead_no_key", severity: "warn", entityRef: row.airtableId, detail: "sin teléfono ni manychatId → dedupKey sintética" });
  }
  return issues;
}

/** Issues completos: per-row + duplicados globales (A26: se marcan, no se fusionan). Solo en full. */
function allIssues(mapped: Array<ReturnType<typeof mapRecord>>): Issue[] {
  const issues = perRowIssues(mapped);
  const byPhone = new Map<string, string[]>();
  const byMany = new Map<string, string[]>();
  for (const { row } of mapped) {
    if (row.phone8) (byPhone.get(row.phone8) ?? byPhone.set(row.phone8, []).get(row.phone8)!).push(row.airtableId);
    if (row.manychatId) (byMany.get(row.manychatId) ?? byMany.set(row.manychatId, []).get(row.manychatId)!).push(row.airtableId);
  }
  for (const [phone8, ids] of byPhone)
    if (ids.length > 1) for (const id of ids)
      issues.push({ issueType: "lead_dup", severity: "info", entityRef: id, detail: `dup phone8 ${phone8} (grupo de ${ids.length})` });
  for (const [mc, ids] of byMany)
    if (ids.length > 1) for (const id of ids)
      issues.push({ issueType: "lead_dup", severity: "info", entityRef: id, detail: `dup manychatId ${mc} (grupo de ${ids.length})` });
  return issues;
}

/* --------------------- Estado del sync en bi_meta (key leads_sync) -------- */
export const readSyncCursor = internalQuery({
  args: {},
  returns: v.union(v.object({ lastRunAt: v.number(), lastStatus: v.string() }), v.null()),
  handler: async (ctx) => {
    const m = await ctx.db
      .query("bi_meta")
      .withIndex("by_key", (q) => q.eq("key", "leads_sync"))
      .unique();
    return m ? { lastRunAt: m.lastRunAt, lastStatus: m.lastStatus } : null;
  },
});

export const writeSyncMeta = internalMutation({
  args: {
    status: v.union(v.literal("ok"), v.literal("error")),
    rowsProcessed: v.number(),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { status, rowsProcessed, message }) => {
    const existing = await ctx.db
      .query("bi_meta")
      .withIndex("by_key", (q) => q.eq("key", "leads_sync"))
      .unique();
    const doc = { key: "leads_sync", lastRunAt: Date.now(), lastStatus: status, rowsProcessed, message };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("bi_meta", doc);
    return null;
  },
});

/* ------------------------------ El sync ----------------------------------- */

/**
 * Resultado del sync. Se declara como tipo con nombre porque el handler
 * referencia funciones de **su propio módulo** (`internal.bi.leadsSync.*`), lo
 * que crea un ciclo de inferencia en TypeScript (TS7022/TS7023). Anotar el
 * retorno lo corta — y sin eso, `next build` falla y los tipos de `api` se
 * degradan a `any` para todo el repo.
 */
type SyncLeadsResult = {
  skipped: boolean;
  mode: string;
  fetched: number;
  inserted: number;
  patched: number;
  failed: number;
  issues: number;
  ms: number;
};

type SyncCursor = { lastRunAt: number; lastStatus: string } | null;

/**
 * Forma de fila que espera `loadLeadsBatch`, derivada de **su propio validador**
 * (no duplicada acá). `mapRecord` construye la fila como `Record<string, any>`
 * porque borra las claves `undefined` en caliente; el validador de la mutation
 * es la autoridad en tiempo de ejecución y rechaza cualquier desvío.
 */
type LeadRowArg = FunctionArgs<
  typeof internal.bi.leads.loadLeadsBatch
>["rows"][number];

export const syncLeadsFromAirtable = internalAction({
  args: { mode: v.optional(v.union(v.literal("full"), v.literal("incremental"))) },
  returns: v.object({
    skipped: v.boolean(),
    mode: v.string(),
    fetched: v.number(),
    inserted: v.number(),
    patched: v.number(),
    failed: v.number(),
    issues: v.number(),
    ms: v.number(),
  }),
  handler: async (ctx, { mode }): Promise<SyncLeadsResult> => {
    const startedAt = Date.now();
    const empty = { skipped: true, mode: mode ?? "", fetched: 0, inserted: 0, patched: 0, failed: 0, issues: 0, ms: 0 };
    if (process.env.AIRTABLE_SYNC_DISABLED === "true") return empty;

    const pat = process.env.AIRTABLE_PAT;
    if (!pat) {
      await ctx.runMutation(internal.bi.leadsSync.writeSyncMeta, {
        status: "error", rowsProcessed: 0, message: "AIRTABLE_PAT ausente en env de Convex",
      });
      throw new Error("AIRTABLE_PAT no configurado");
    }

    const cursor: SyncCursor = await ctx.runQuery(
      internal.bi.leadsSync.readSyncCursor,
      {},
    );
    const isFull = mode === "full" || !cursor || !cursor.lastRunAt;
    const sinceISO = isFull ? null : new Date(cursor!.lastRunAt).toISOString();
    const runId = `leads_sync_${isFull ? "full" : "inc"}_${startedAt}`;

    // 1) Traer de Airtable (paginado, read-only, ~4 req/s < límite 5)
    const records: any[] = [];
    let offset: string | undefined = undefined;
    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`);
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("returnFieldsByFieldId", "true");
      if (sinceISO) url.searchParams.set("filterByFormula", `IS_AFTER(LAST_MODIFIED_TIME(), '${sinceISO}')`);
      if (offset) url.searchParams.set("offset", offset);
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${pat}` } });
      if (!res.ok) {
        const body = await res.text();
        await ctx.runMutation(internal.bi.leadsSync.writeSyncMeta, {
          status: "error", rowsProcessed: records.length, message: `Airtable API ${res.status}: ${body.slice(0, 180)}`,
        });
        throw new Error(`Airtable API ${res.status}`);
      }
      const data: any = await res.json();
      for (const r of data.records ?? []) records.push(r);
      offset = data.offset;
      if (offset) await new Promise((r) => setTimeout(r, 250));
    } while (offset);

    // 2) Mapear + upsert idempotente por airtableId (reusa loadLeadsBatch)
    const mapped = records.map(mapRecord);
    const rows = mapped.map((m) => m.row as LeadRowArg);
    if (isFull) await ctx.runMutation(internal.bi.leads.resetLeadIssues, {});

    const totals = { received: 0, inserted: 0, patched: 0, failed: 0 };
    for (let i = 0; i < rows.length; i += 250) {
      const res = await ctx.runMutation(internal.bi.leads.loadLeadsBatch, { rows: rows.slice(i, i + 250), runId });
      totals.received += res.received; totals.inserted += res.inserted;
      totals.patched += res.patched; totals.failed += res.failed;
    }

    // 3) Issues — solo recompute global en full (incremental los refresca el full semanal)
    let issuesInserted = 0;
    if (isFull) {
      const issues = allIssues(mapped);
      for (let i = 0; i < issues.length; i += 500) {
        const res = await ctx.runMutation(internal.bi.leads.loadLeadIssues, { issues: issues.slice(i, i + 500), runId });
        issuesInserted += res.inserted;
      }
    }

    const status = totals.failed === 0 ? "ok" : "error";
    await ctx.runMutation(internal.bi.leadsSync.writeSyncMeta, {
      status,
      rowsProcessed: totals.received,
      message: `${isFull ? "full" : "incremental"}: fetched=${records.length} ins=${totals.inserted} patch=${totals.patched} fail=${totals.failed} issues=${issuesInserted}`,
    });

    return {
      skipped: false,
      mode: isFull ? "full" : "incremental",
      fetched: records.length,
      inserted: totals.inserted,
      patched: totals.patched,
      failed: totals.failed,
      issues: issuesInserted,
      ms: Date.now() - startedAt,
    };
  },
});

/**
 * Refresco bajo demanda para el dashboard (RF-08). Mutation pública con
 * `requireAdmin` (solo Esteban): valida admin y agenda el sync incremental
 * (rápido) vía scheduler; devuelve enseguida sin bloquear la UI.
 */
export const refreshLeadsNow = mutation({
  args: {},
  returns: v.object({ scheduled: v.boolean() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    await ctx.scheduler.runAfter(0, internal.bi.leadsSync.syncLeadsFromAirtable, {
      mode: "incremental",
    });
    return { scheduled: true };
  },
});
