/**
 * Cron jobs de Convex.
 *
 * Sync semanal de leads (A35, INTERINO): mientras Airtable siga captando leads,
 * refresca `leads_contacts` una vez por semana con un sync **full** (reset +
 * recompute de issues; ~8,4k filas es barato). Se apaga sin tocar código con
 * `AIRTABLE_SYNC_DISABLED="true"` (el action corta al inicio). Se retira en el
 * cutover a full-Convex.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.weekly(
  "weekly-leads-sync",
  { dayOfWeek: "monday", hourUTC: 9, minuteUTC: 0 }, // ~3:00 a.m. CR (UTC-6)
  internal.bi.leadsSync.syncLeadsFromAirtable,
  { mode: "full" },
);

export default crons;
