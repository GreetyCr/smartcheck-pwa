"use client";

import { LeadsDashboard } from "@/components/bi/LeadsDashboard";
import type {
  ConversionFunnel,
  LeadsStats,
  MatchesStats,
} from "@/components/bi/types";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Datos de MUESTRA (no salen de Convex).
 *
 * Los agregados sí copian los de producción —8.706 leads, 180 conversiones,
 * 2,07%— porque el punto de esta vista es revisar el diseño con las magnitudes
 * reales: una conversión del 2% se ve muy distinta a una del 30%, y es
 * justamente la astilla del embudo lo que hay que aprobar.
 *
 * Los nombres y teléfonos, en cambio, son **inventados**: esta vista no pide
 * sesión y la tabla de "quiénes convirtieron" muestra datos de clientes.
 */
const D = (iso: string) => Date.parse(`${iso}T00:00:00-06:00`);

const FUNNEL: ConversionFunnel = {
  leadsTotal: 8706,
  leadsWithPhone: 8639,
  leadsMatched: 238,
  converted: 180,
  convertedRatePct: 2.07,
  convertedRateOfPhonedPct: 2.08,
  possibleAdditionalByName: 58,
  possibleAdditionalByNameRatePct: 0.67,
  convertedIncludingName: 238,
  placeholderMatches: 0,
  byBand: [
    { band: "alta", rows: 152 },
    { band: "media", rows: 28 },
    { band: "baja", rows: 58 },
  ],
  byMethod: [
    { method: "phone_exact", rows: 152 },
    { method: "phone_vehicle_window", rows: 28 },
    { method: "name_vehicle_window", rows: 58 },
  ],
  byTarget: [
    { target: "legacy", rows: 155 },
    { target: "era_app", rows: 83 },
  ],
  sampleWhoConverts: [
    { leadName: "Marisol Vargas", phone8: "88110042", inspectionDate: "2026-08-07", amountCRC: 69_000, confidenceBand: "alta", matchTarget: "era_app" },
    { leadName: "Rodolfo Chinchilla", phone8: "70443311", inspectionDate: "2026-08-07", amountCRC: 40_000, confidenceBand: "media", matchTarget: "era_app" },
    { leadName: "Kimberly Solano", phone8: "62119087", inspectionDate: "2026-08-05", amountCRC: 59_000, confidenceBand: "alta", matchTarget: "era_app" },
    { leadName: "Álvaro Zamora", phone8: "83550214", inspectionDate: "2026-08-04", amountCRC: 50_000, confidenceBand: "alta", matchTarget: "legacy" },
    { leadName: undefined, phone8: "71028834", inspectionDate: "2026-08-02", amountCRC: 68_850, confidenceBand: "media", matchTarget: "legacy" },
    { leadName: "Douglas Arias Mora", phone8: "84772093", inspectionDate: "2026-07-30", amountCRC: 45_000, confidenceBand: "alta", matchTarget: "legacy" },
    { leadName: "Natalia Fonseca", phone8: "60031178", inspectionDate: "2026-07-28", amountCRC: 59_000, confidenceBand: "alta", matchTarget: "era_app" },
    { leadName: "Wilberth Núñez", phone8: "89903611", inspectionDate: "2026-07-27", amountCRC: 72_500, confidenceBand: "alta", matchTarget: "legacy" },
    { leadName: "Sofía Ledezma", phone8: "83440027", inspectionDate: "2026-07-25", amountCRC: 50_000, confidenceBand: "media", matchTarget: "legacy" },
    { leadName: "Esteban Rojas Ureña", phone8: "70995512", inspectionDate: "2026-07-23", amountCRC: 59_000, confidenceBand: "alta", matchTarget: "era_app" },
    { leadName: "Gabriela Mena", phone8: "85002244", inspectionDate: "2026-07-21", amountCRC: 40_000, confidenceBand: "alta", matchTarget: "legacy" },
    { leadName: "Jean Carlo Umaña", phone8: "61778350", inspectionDate: "2026-07-19", amountCRC: 65_000, confidenceBand: "alta", matchTarget: "legacy" },
  ],
  note: "channel no está disponible en leads (Airtable vacío); sin desglose por canal del lado lead.",
};

const MATCHES: MatchesStats = {
  totalMatches: 238,
  ambiguous: 28,
  validIncome: 238,
  invalidIncome: 0,
  byMatchKeyKind: [
    { kind: "phone", rows: 180 },
    { kind: "name", rows: 58 },
  ],
  byMethod: FUNNEL.byMethod,
  byBand: FUNNEL.byBand,
  byTarget: FUNNEL.byTarget,
  leadsWithPhone: 8639,
  leadsWithoutMatch: 8468,
  ambiguousMatchIssues: 28,
};

const LEADS: LeadsStats = {
  total: 8706,
  isDeleted: 0,
  phone8Present: 8639,
  manychatPresent: 8232,
  namePresent: 8527,
  phoneValidTrue: 8541,
  phoneValidFalse: 165,
  dupPhone8Groups: 476,
  dupPhone8ExcessRows: 507,
  dupManychatGroups: 371,
  dupManychatExcessRows: 391,
  minSourceCreatedAt: D("2025-11-20"),
  maxSourceCreatedAt: D("2026-08-08"),
  sourceCreatedPresent: 8706,
  byStage: [
    { stage: "nuevo", rows: 8526 },
    { stage: "convertido", rows: 180 },
  ],
  byChannel: [{ channel: "(vacío)", rows: 8706 }],
  issuesByType: [
    { issueType: "lead_dup", rows: 1745 },
    { issueType: "anomalous_phone", rows: 152 },
    { issueType: "lead_no_key", rows: 31 },
  ],
};

export function LeadsPreview() {
  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — datos de muestra, nombres y
        teléfonos inventados. No existe en producción.
      </div>
      {/* Acá no hay shell de /admin, así que este envoltorio hace su papel:
          aplica el tema grafito y el mismo padding de contenido. */}
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <LeadsDashboard funnel={FUNNEL} matches={MATCHES} leads={LEADS} />
      </div>
    </>
  );
}
