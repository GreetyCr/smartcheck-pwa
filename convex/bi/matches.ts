/**
 * Embudo de conversión lead → cliente — rebuild de `bi_matches` + queries (B7).
 *
 * Empareja cada lead (por `phone8`, con desambiguación vehículo/ventana y un
 * fallback débil por nombre) contra la **UNIÓN de TODAS las inspecciones reales**
 * (`inspections` era-app ∪ `inspections_legacy`) — decisión A29. Un lead
 * convierte si matchea CUALQUIER inspección real; se **dedupe por LEAD** (un lead
 * = una conversión: cada lead recibe a lo sumo un match, el mejor por banda de
 * confianza). NO se usa la vista deduplicada por corte del §8 para el matching:
 * el corte 2026-07-01 aplica SOLO al conteo de "total de revisiones" (métrica
 * separada), porque la dedup por corte descartaba las inspecciones era-app
 * (mayo–jun, 100% con teléfono) donde el legacy trae teléfono en solo 191/712,
 * perdiendo conversiones reales de alta confianza. Materializa `bi_matches`
 * (verdad de conversión) y sincroniza las cachés
 * `leads_contacts.linkedInspectionId`/`linkedLegacyId`/`leadStage`.
 *
 * Patrón (AGENTS §7.6, estilo de `bi/{legacy,finance,leads}.ts`):
 * `internalMutation` idempotente (reset + rebuild completo), try/catch por grupo
 * (fila mala → `bi_quality_issues`, nunca aborta), `setMatchesMeta`,
 * `resetMatchesIssues`, e `internalQuery` de embudo/stats.
 *
 * SOLO LECTURA sobre `inspections`/`inspections_legacy` (RNF-01): solo se leen
 * para emparejar; jamás se modifican. SOLO DEV en este WP.
 */

import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { isoDate } from "./lib/dates";

/* -------------------------------------------------------------------------- */
/* Reglas / constantes                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Fecha de corte del §8. NO se usa para el matching de conversión (A29: se
 * empareja contra la unión total de inspecciones). Se conserva documentada
 * porque sigue rigiendo el conteo separado de "total de revisiones".
 */
const CUTOVER_MS = Date.parse("2026-07-01T00:00:00-06:00");
void CUTOVER_MS;

/**
 * Umbral de "ingreso válido" que define CONVERSIÓN. El brief pide monto > 0,
 * pero MODELO §3 (B15) marca ₡0 y ₡1.000 como placeholders/datos viejos; un
 * match a una inspección placeholder NO es una conversión real. Por eso el
 * umbral es **> 1.000** (excluye ambos). El embudo expone cuántos matches caen
 * en placeholder (`placeholderMatches`) para que el equipo decida si aflojarlo a
 * > 0. En DEV no cambia el conteo: los 712 legacy < corte tienen amountCRC > 1000
 * y las era-app (todas < corte) no entran en la ventana.
 */
const MIN_VALID_INCOME_CRC = 1000;
const isValidIncome = (amt: number | undefined | null): boolean =>
  amt != null && amt > MIN_VALID_INCOME_CRC;

/** Ventana temporal razonable lead→inspección (para scoring, no filtro duro). */
const WINDOW_BEFORE_MS = 7 * 24 * 3600 * 1000; // lead hasta 7d después de la inspección
const WINDOW_AFTER_MS = 180 * 24 * 3600 * 1000; // inspección hasta 180d después del lead

/* -------------------------------------------------------------------------- */
/* Helpers de normalización (no hay lib/phone.ts todavía; inline y acotado)    */
/* -------------------------------------------------------------------------- */

/** Últimos 8 dígitos CR; null si placeholder/anómalo (00000000, < 8 díg). */
function last8(raw: string | undefined | null): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  const p = d.slice(-8);
  if (p === "00000000") return null;
  return p;
}

/** Normaliza texto (nombre/marca): minúsculas, sin acentos, espacios colapsados. */
function norm(s: string | undefined | null): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Tipos internos                                                             */
/* -------------------------------------------------------------------------- */

type UnifiedInspection = {
  target: "era_app" | "legacy";
  eraId?: Id<"inspections">;
  legacyId?: Id<"inspections_legacy">;
  phone8: string | null;
  brand: string; // normalizado
  name: string; // normalizado (clientName)
  dateMs: number | null;
  amountCRC: number | undefined;
  valid: boolean;
};

/* -------------------------------------------------------------------------- */
/* Rebuild idempotente                                                        */
/* -------------------------------------------------------------------------- */

const rebuildResult = v.object({
  runId: v.string(),
  leadsTotal: v.number(),
  leadsWithPhone: v.number(),
  unifiedEraApp: v.number(),
  unifiedLegacy: v.number(),
  matchesInserted: v.number(),
  converted: v.number(),
  byMethod: v.array(v.object({ method: v.string(), rows: v.number() })),
  byBand: v.array(v.object({ band: v.string(), rows: v.number() })),
  ambiguousPhones: v.number(),
  leadCacheUpdated: v.number(),
  leadCacheCleared: v.number(),
  failed: v.number(),
});

export const rebuildMatches = internalMutation({
  args: { runId: v.optional(v.string()) },
  returns: rebuildResult,
  handler: async (ctx, args) => {
    const now = Date.now();
    const runId = args.runId ?? `matches:${now}`;

    /* -------- 0. Reset idempotente (matches + issues de esta entidad) ------- */
    for (const m of await ctx.db.query("bi_matches").collect()) {
      await ctx.db.delete(m._id);
    }
    for (const i of await ctx.db.query("bi_quality_issues").collect()) {
      if (i.entity === "bi_matches") await ctx.db.delete(i._id);
    }

    /* -------- 1. UNIÓN de TODAS las inspecciones reales (A29) --------------- */
    /* Sin dedup por corte: para conversión un lead matchea CUALQUIER inspección */
    /* real (era-app ∪ legacy). El corte 2026-07-01 NO se aplica aquí (vive en   */
    /* el conteo de "total de revisiones", métrica aparte).                      */
    const unified: UnifiedInspection[] = [];
    let unifiedEraApp = 0;
    let unifiedLegacy = 0;

    for (const r of await ctx.db.query("inspections").collect()) {
      const dateMs = r.inspectionStartAt ?? r._creationTime;
      unifiedEraApp++;
      unified.push({
        target: "era_app",
        eraId: r._id,
        phone8: last8(r.clientPhone),
        brand: norm(r.vehicleBrand),
        name: norm(r.clientName),
        dateMs,
        amountCRC: r.totalAmountCharged ?? undefined,
        valid: isValidIncome(r.totalAmountCharged),
      });
    }

    for (const r of await ctx.db.query("inspections_legacy").collect()) {
      unifiedLegacy++;
      unified.push({
        target: "legacy",
        legacyId: r._id,
        phone8: r.phone8 ? last8(r.phone8) : null,
        brand: norm(r.vehicleBrand),
        name: norm(r.clientName),
        dateMs: r.inspectionDate > 0 ? r.inspectionDate : null,
        amountCRC: r.amountCRC ?? undefined,
        valid: isValidIncome(r.amountCRC),
      });
    }

    // Índices en memoria
    const inspByPhone = new Map<string, UnifiedInspection[]>();
    const inspByNameBrand = new Map<string, UnifiedInspection[]>();
    for (const u of unified) {
      if (u.phone8) {
        const a = inspByPhone.get(u.phone8) ?? [];
        a.push(u);
        inspByPhone.set(u.phone8, a);
      }
      if (u.name && u.brand) {
        const k = `${u.name}|${u.brand}`;
        const a = inspByNameBrand.get(k) ?? [];
        a.push(u);
        inspByNameBrand.set(k, a);
      }
    }

    /* -------- 2. Índice de leads por phone8 (para detectar ambigüedad) ------ */
    const leads = await ctx.db.query("leads_contacts").collect();
    const leadsByPhone = new Map<string, Doc<"leads_contacts">[]>();
    let leadsWithPhone = 0;
    for (const l of leads) {
      if (l.isDeleted) continue;
      if (l.phone8) {
        leadsWithPhone++;
        const a = leadsByPhone.get(l.phone8) ?? [];
        a.push(l);
        leadsByPhone.set(l.phone8, a);
      }
    }

    /* -------- 3. Emparejar. Cada inspección se atribuye a lo sumo a UN lead - */
    /* (evita inflar la conversión cuando varios leads comparten un teléfono). */
    const claimedInsp = new Set<string>(); // eraId/legacyId ya atribuidos
    const uKey = (u: UnifiedInspection) =>
      u.target === "era_app" ? `e:${u.eraId}` : `l:${u.legacyId}`;

    // Puntúa la afinidad lead↔inspección (ingreso válido + marca + ventana).
    const score = (l: Doc<"leads_contacts">, u: UnifiedInspection): number => {
      let s = 0;
      // Preferí una inspección de ingreso válido: que un placeholder (₡1.000) no
      // le "robe" el lead a una inspección real cuando comparten teléfono.
      if (u.valid) s += 200;
      const lb = norm(l.vehicleBrand);
      if (lb && u.brand && lb === u.brand) s += 100;
      if (l.sourceCreatedAt != null && u.dateMs != null) {
        const gap = u.dateMs - l.sourceCreatedAt; // >0: inspección después del lead (esperado)
        if (gap >= -WINDOW_BEFORE_MS && gap <= WINDOW_AFTER_MS) s += 50;
        s += Math.max(0, 40 - Math.abs(gap) / (24 * 3600 * 1000)); // cercanía (días)
      }
      return s;
    };

    type Pending = {
      lead: Doc<"leads_contacts">;
      insp: UnifiedInspection;
      method: "phone_exact" | "phone_vehicle_window" | "name_vehicle_window";
      band: "alta" | "media" | "baja";
      confidence: number;
      ambiguous: boolean;
      matchKey: string;
    };
    const pending: Pending[] = [];
    const matchedLeadIds = new Set<string>();
    let ambiguousPhones = 0;
    let failed = 0;

    // 3a. Grupos por phone8 presentes en leads e inspecciones.
    for (const [phone8, insps] of inspByPhone) {
      try {
        const groupLeads = leadsByPhone.get(phone8);
        if (!groupLeads || groupLeads.length === 0) continue;

        const ambiguous = groupLeads.length > 1 || insps.length > 1;
        if (ambiguous) {
          ambiguousPhones++;
          await ctx.db.insert("bi_quality_issues", {
            issueType: "ambiguous_match",
            severity: "warn",
            entity: "bi_matches",
            entityRef: `phone:${phone8}`,
            detail: `phone8 ${phone8}: ${groupLeads.length} lead(s) × ${insps.length} inspección(es); desambiguado por vehículo/ventana`,
            runId,
            detectedAt: now,
            resolved: false,
          });
        }

        // Asignación voraz: cada inspección (cronológica) toma su mejor lead libre.
        const inspSorted = [...insps].sort(
          (a, b) => (a.dateMs ?? 0) - (b.dateMs ?? 0),
        );
        const usedLead = new Set<string>();
        for (const u of inspSorted) {
          let best: Doc<"leads_contacts"> | null = null;
          let bestScore = -Infinity;
          for (const l of groupLeads) {
            if (usedLead.has(l._id)) continue;
            const sc = score(l, u);
            if (sc > bestScore) {
              bestScore = sc;
              best = l;
            }
          }
          if (!best) break; // más inspecciones que leads → inspección sin lead (se ignora)
          usedLead.add(best._id);
          claimedInsp.add(uKey(u));
          matchedLeadIds.add(best._id);
          const brandMatch =
            norm(best.vehicleBrand) !== "" &&
            norm(best.vehicleBrand) === u.brand;
          pending.push({
            lead: best,
            insp: u,
            method: ambiguous ? "phone_vehicle_window" : "phone_exact",
            band: ambiguous ? "media" : "alta",
            confidence: ambiguous ? (brandMatch ? 0.7 : 0.6) : 0.9,
            ambiguous,
            matchKey: `phone:${phone8}`,
          });
        }
      } catch (err) {
        failed++;
        await ctx.db.insert("bi_quality_issues", {
          issueType: "load_error",
          severity: "error",
          entity: "bi_matches",
          entityRef: `phone:${phone8}`,
          detail: String(err instanceof Error ? err.message : err),
          runId,
          detectedAt: now,
          resolved: false,
        });
      }
    }

    // 3b. Fallback débil (baja): leads SIN match por teléfono, por nombre+marca.
    // Endurecido para acotar falsos positivos (nombres/ marcas comunes):
    //   - nombre COMPLETO (≥2 tokens: nombre + apellido), no solo pila;
    //   - traslape temporal REAL (lead y inspección con fecha y dentro de ventana).
    for (const l of leads) {
      if (l.isDeleted) continue;
      if (matchedLeadIds.has(l._id)) continue;
      const n = norm(l.name);
      const b = norm(l.vehicleBrand);
      if (!n || !b) continue;
      if (n.split(" ").filter(Boolean).length < 2) continue; // exige nombre completo
      const cands = inspByNameBrand.get(`${n}|${b}`);
      if (!cands) continue;
      // mejor inspección libre CON ventana temporal (obligatoria en el fallback)
      let best: UnifiedInspection | null = null;
      let bestScore = -Infinity;
      for (const u of cands) {
        if (claimedInsp.has(uKey(u))) continue;
        if (l.sourceCreatedAt == null || u.dateMs == null) continue; // sin fechas → no arriesgar
        const gap = u.dateMs - l.sourceCreatedAt;
        if (gap < -WINDOW_BEFORE_MS || gap > WINDOW_AFTER_MS) continue; // fuera de ventana
        const sc = score(l, u);
        if (sc > bestScore) {
          bestScore = sc;
          best = u;
        }
      }
      if (!best) continue;
      claimedInsp.add(uKey(best));
      matchedLeadIds.add(l._id);
      pending.push({
        lead: l,
        insp: best,
        method: "name_vehicle_window",
        band: "baja",
        confidence: 0.35,
        ambiguous: false,
        matchKey: `name:${n}|brand:${b}`,
      });
    }

    /* -------- 4. Materializar bi_matches + sincronizar cachés de lead ------- */
    let matchesInserted = 0;
    let converted = 0;
    let leadCacheUpdated = 0;
    const byMethod = new Map<string, number>();
    const byBand = new Map<string, number>();

    for (const p of pending) {
      const u = p.insp;
      const validIncome = u.valid;
      await ctx.db.insert("bi_matches", {
        phone8: p.lead.phone8,
        leadDedupKey: p.lead.dedupKey,
        leadId: p.lead._id,
        matchTarget: u.target,
        inspectionId: u.eraId,
        legacyInspectionId: u.legacyId,
        matchMethod: p.method,
        matchKey: p.matchKey,
        confidence: p.confidence,
        confidenceBand: p.band,
        ambiguous: p.ambiguous,
        validIncome,
        inspectionDate: u.dateMs ?? undefined,
        amountCRC: u.amountCRC,
        computedAt: now,
      });
      matchesInserted++;
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + 1);
      byBand.set(p.band, (byBand.get(p.band) ?? 0) + 1);
      if (validIncome) converted++;

      // Caché operativa en el lead (la verdad sigue en bi_matches).
      // `convertido` solo para la métrica titular (teléfono, bandas alta+media);
      // el fallback débil por nombre (baja) NO marca convertido (A29).
      const patch: Record<string, unknown> = {
        linkedInspectionId: u.target === "era_app" ? u.eraId : undefined,
        linkedLegacyId: u.target === "legacy" ? u.legacyId : undefined,
        updatedAt: now,
      };
      if (validIncome && p.band !== "baja") patch.leadStage = "convertido";
      await ctx.db.patch(p.lead._id, patch);
      leadCacheUpdated++;
    }

    /* -------- 5. Limpiar cachés de leads que ya NO están emparejados -------- */
    let leadCacheCleared = 0;
    for (const l of leads) {
      if (matchedLeadIds.has(l._id)) continue;
      const wasCached =
        l.leadStage === "convertido" ||
        l.linkedInspectionId != null ||
        l.linkedLegacyId != null;
      if (!wasCached) continue;
      await ctx.db.patch(l._id, {
        leadStage: l.leadStage === "convertido" ? "nuevo" : l.leadStage,
        linkedInspectionId: undefined,
        linkedLegacyId: undefined,
        updatedAt: now,
      });
      leadCacheCleared++;
    }

    /* -------- 6. Meta ------------------------------------------------------- */
    await setMeta(ctx, "ok", matchesInserted, `converted=${converted}`);

    return {
      runId,
      leadsTotal: leads.length,
      leadsWithPhone,
      unifiedEraApp,
      unifiedLegacy,
      matchesInserted,
      converted,
      byMethod: [...byMethod.entries()].map(([method, rows]) => ({
        method,
        rows,
      })),
      byBand: [...byBand.entries()].map(([band, rows]) => ({ band, rows })),
      ambiguousPhones,
      leadCacheUpdated,
      leadCacheCleared,
      failed,
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Meta / reset (mismos helpers de estilo que legacy/finance/leads)           */
/* -------------------------------------------------------------------------- */

async function setMeta(
  ctx: { db: any },
  status: "ok" | "error",
  rowsProcessed: number,
  message?: string,
): Promise<void> {
  const existing = await ctx.db
    .query("bi_meta")
    .withIndex("by_key", (q: any) => q.eq("key", "matches_rebuild"))
    .unique();
  const doc = {
    key: "matches_rebuild",
    lastRunAt: Date.now(),
    lastStatus: status,
    rowsProcessed,
    message,
  };
  if (existing) await ctx.db.patch(existing._id, doc);
  else await ctx.db.insert("bi_meta", doc);
}

/** Upsert de `bi_meta` (frescura/estado del proceso, RF-09). key = "matches_rebuild". */
export const setMatchesMeta = internalMutation({
  args: {
    status: v.union(v.literal("ok"), v.literal("error")),
    rowsProcessed: v.number(),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { status, rowsProcessed, message }) => {
    await setMeta(ctx, status, rowsProcessed, message);
    return null;
  },
});

/** Limpia matches + issues `entity="bi_matches"` de corridas previas (idempotencia). */
export const resetMatchesIssues = internalMutation({
  args: {},
  returns: v.object({ matchesDeleted: v.number(), issuesDeleted: v.number() }),
  handler: async (ctx) => {
    let matchesDeleted = 0;
    for (const m of await ctx.db.query("bi_matches").collect()) {
      await ctx.db.delete(m._id);
      matchesDeleted++;
    }
    let issuesDeleted = 0;
    for (const i of await ctx.db.query("bi_quality_issues").collect()) {
      if (i.entity === "bi_matches") {
        await ctx.db.delete(i._id);
        issuesDeleted++;
      }
    }
    return { matchesDeleted, issuesDeleted };
  },
});

/* -------------------------------------------------------------------------- */
/* Embudo de conversión (B7) — "quiénes convierten"                          */
/* -------------------------------------------------------------------------- */

/** Forma de retorno del embudo — la reusa el wrapper público (`bi/public.ts`). */
export const conversionFunnelReturns = v.object({
    leadsTotal: v.number(),
    leadsWithPhone: v.number(),
    leadsMatched: v.number(), // con match (válido o no)
    // MÉTRICA TITULAR (A29): conversión por teléfono, bandas alta+media.
    converted: v.number(),
    convertedRatePct: v.number(), // converted / leadsTotal(8.400) * 100
    convertedRateOfPhonedPct: v.number(), // converted / leadsWithPhone * 100
    // APARTE (no titular): fallback débil por nombre (banda baja) = posibles adicionales.
    possibleAdditionalByName: v.number(),
    possibleAdditionalByNameRatePct: v.number(), // sobre leadsTotal(8.400)
    convertedIncludingName: v.number(), // titular + posibles adicionales (referencia)
    placeholderMatches: v.number(), // match a inspección ₡0/₡1000 (NO cuenta)
    byBand: v.array(v.object({ band: v.string(), rows: v.number() })),
    byMethod: v.array(v.object({ method: v.string(), rows: v.number() })),
    byTarget: v.array(v.object({ target: v.string(), rows: v.number() })),
    sampleWhoConverts: v.array(
      v.object({
        leadName: v.optional(v.string()),
        phone8: v.optional(v.string()),
        inspectionDate: v.optional(v.string()),
        amountCRC: v.optional(v.number()),
        confidenceBand: v.string(),
        matchTarget: v.string(),
      }),
    ),
  note: v.string(),
});

/**
 * Cómputo del embudo, como función plana. Vive fuera del wrapper de Convex para
 * que la `internalQuery` (CLI/scripts, sin auth) y la query pública del tablero
 * (con `requireAdmin`) compartan el mismo cálculo: en Convex una `query` no
 * puede `ctx.runQuery` (A41), pero sí llamar a un helper que recibe `ctx`.
 */
export async function conversionFunnelImpl(
  ctx: QueryCtx,
  { sampleSize }: { sampleSize?: number },
) {
    const leads = await ctx.db.query("leads_contacts").collect();
    const leadsTotal = leads.filter((l) => !l.isDeleted).length;
    const leadsWithPhone = leads.filter(
      (l) => !l.isDeleted && l.phone8,
    ).length;

    const matches = await ctx.db.query("bi_matches").collect();
    const leadsMatched = matches.length;
    let converted = 0; // titular: validIncome + banda alta/media
    let possibleAdditionalByName = 0; // validIncome + banda baja (nombre)
    let placeholderMatches = 0;
    const byBand = new Map<string, number>();
    const byMethod = new Map<string, number>();
    const byTarget = new Map<string, number>();
    for (const m of matches) {
      if (m.validIncome) {
        if (m.confidenceBand === "baja") possibleAdditionalByName++;
        else converted++;
      } else placeholderMatches++;
      byBand.set(m.confidenceBand, (byBand.get(m.confidenceBand) ?? 0) + 1);
      byMethod.set(m.matchMethod, (byMethod.get(m.matchMethod) ?? 0) + 1);
      byTarget.set(m.matchTarget, (byTarget.get(m.matchTarget) ?? 0) + 1);
    }

    // Muestra "quiénes convierten": titular (alta+media) válidos, recientes primero.
    const n = sampleSize ?? 25;
    const leadName = new Map<string, string | undefined>();
    for (const l of leads) leadName.set(l._id, l.name);
    const sampleWhoConverts = matches
      .filter((m) => m.validIncome && m.confidenceBand !== "baja")
      .sort((a, b) => (b.inspectionDate ?? 0) - (a.inspectionDate ?? 0))
      .slice(0, n)
      .map((m) => ({
        leadName: m.leadId ? leadName.get(m.leadId) : undefined,
        phone8: m.phone8,
        inspectionDate:
          m.inspectionDate != null ? isoDate(m.inspectionDate) : undefined,
        amountCRC: m.amountCRC,
        confidenceBand: m.confidenceBand,
        matchTarget: m.matchTarget,
      }));

    const pct = (x: number, d: number) =>
      d > 0 ? Math.round((x / d) * 10000) / 100 : 0;

    return {
      leadsTotal,
      leadsWithPhone,
      leadsMatched,
      converted,
      convertedRatePct: pct(converted, leadsTotal),
      convertedRateOfPhonedPct: pct(converted, leadsWithPhone),
      possibleAdditionalByName,
      possibleAdditionalByNameRatePct: pct(possibleAdditionalByName, leadsTotal),
      convertedIncludingName: converted + possibleAdditionalByName,
      placeholderMatches,
      byBand: [...byBand.entries()].map(([band, rows]) => ({ band, rows })),
      byMethod: [...byMethod.entries()].map(([method, rows]) => ({
        method,
        rows,
      })),
      byTarget: [...byTarget.entries()].map(([target, rows]) => ({
        target,
        rows,
      })),
      sampleWhoConverts,
      note: "channel no está disponible en leads (Airtable vacío); sin desglose por canal del lado lead.",
    };
}

export const conversionFunnel = internalQuery({
  args: { sampleSize: v.optional(v.number()) },
  returns: conversionFunnelReturns,
  handler: async (ctx, args) => conversionFunnelImpl(ctx, args),
});

/* -------------------------------------------------------------------------- */
/* Stats de matching                                                          */
/* -------------------------------------------------------------------------- */

/** Forma de retorno de las stats de matching — la reusa `bi/public.ts`. */
export const matchesStatsReturns = v.object({
    totalMatches: v.number(),
    ambiguous: v.number(),
    validIncome: v.number(),
    invalidIncome: v.number(),
    byMatchKeyKind: v.array(v.object({ kind: v.string(), rows: v.number() })),
    byMethod: v.array(v.object({ method: v.string(), rows: v.number() })),
    byBand: v.array(v.object({ band: v.string(), rows: v.number() })),
    byTarget: v.array(v.object({ target: v.string(), rows: v.number() })),
    leadsWithPhone: v.number(),
    leadsWithoutMatch: v.number(),
  ambiguousMatchIssues: v.number(),
});

/** Cómputo de las stats de matching, plano y compartido (ver `conversionFunnelImpl`). */
export async function matchesStatsImpl(ctx: QueryCtx) {
    const matches = await ctx.db.query("bi_matches").collect();
    let ambiguous = 0;
    let validIncome = 0;
    let invalidIncome = 0;
    const byKind = new Map<string, number>();
    const byMethod = new Map<string, number>();
    const byBand = new Map<string, number>();
    const byTarget = new Map<string, number>();
    const matchedLeadIds = new Set<string>();
    for (const m of matches) {
      if (m.ambiguous) ambiguous++;
      if (m.validIncome) validIncome++;
      else invalidIncome++;
      const kind = m.matchKey.startsWith("phone:") ? "phone" : "name";
      byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
      byMethod.set(m.matchMethod, (byMethod.get(m.matchMethod) ?? 0) + 1);
      byBand.set(m.confidenceBand, (byBand.get(m.confidenceBand) ?? 0) + 1);
      byTarget.set(m.matchTarget, (byTarget.get(m.matchTarget) ?? 0) + 1);
      if (m.leadId) matchedLeadIds.add(m.leadId);
    }

    const leads = await ctx.db.query("leads_contacts").collect();
    let leadsWithPhone = 0;
    for (const l of leads) if (!l.isDeleted && l.phone8) leadsWithPhone++;
    const leadsWithoutMatch =
      leads.filter((l) => !l.isDeleted).length - matchedLeadIds.size;

    const issues = await ctx.db.query("bi_quality_issues").collect();
    const ambiguousMatchIssues = issues.filter(
      (i) => i.entity === "bi_matches" && i.issueType === "ambiguous_match",
    ).length;

    const toArr = (m: Map<string, number>, key: string) =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, rows]) => ({ [key]: k, rows }) as any);

    return {
      totalMatches: matches.length,
      ambiguous,
      validIncome,
      invalidIncome,
      byMatchKeyKind: toArr(byKind, "kind"),
      byMethod: toArr(byMethod, "method"),
      byBand: toArr(byBand, "band"),
      byTarget: toArr(byTarget, "target"),
      leadsWithPhone,
      leadsWithoutMatch,
      ambiguousMatchIssues,
    };
}

export const matchesStats = internalQuery({
  args: {},
  returns: matchesStatsReturns,
  handler: async (ctx) => matchesStatsImpl(ctx),
});
