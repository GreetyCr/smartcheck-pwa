/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as bi_finance from "../bi/finance.js";
import type * as bi_financeForm from "../bi/financeForm.js";
import type * as bi_leads from "../bi/leads.js";
import type * as bi_leadsSync from "../bi/leadsSync.js";
import type * as bi_legacy from "../bi/legacy.js";
import type * as bi_lib_dates from "../bi/lib/dates.js";
import type * as bi_lib_financeRules from "../bi/lib/financeRules.js";
import type * as bi_matches from "../bi/matches.js";
import type * as bi_metrics from "../bi/metrics.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as inspections from "../inspections.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_commission from "../lib/commission.js";
import type * as lib_externalPhotoUrl from "../lib/externalPhotoUrl.js";
import type * as lib_sanitizeSectionPatch from "../lib/sanitizeSectionPatch.js";
import type * as lib_validateInspectionDraft from "../lib/validateInspectionDraft.js";
import type * as migrations from "../migrations.js";
import type * as n8nWebhook from "../n8nWebhook.js";
import type * as pdfs from "../pdfs.js";
import type * as sections from "../sections.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "bi/finance": typeof bi_finance;
  "bi/financeForm": typeof bi_financeForm;
  "bi/leads": typeof bi_leads;
  "bi/leadsSync": typeof bi_leadsSync;
  "bi/legacy": typeof bi_legacy;
  "bi/lib/dates": typeof bi_lib_dates;
  "bi/lib/financeRules": typeof bi_lib_financeRules;
  "bi/matches": typeof bi_matches;
  "bi/metrics": typeof bi_metrics;
  crons: typeof crons;
  http: typeof http;
  inspections: typeof inspections;
  "lib/auth": typeof lib_auth;
  "lib/commission": typeof lib_commission;
  "lib/externalPhotoUrl": typeof lib_externalPhotoUrl;
  "lib/sanitizeSectionPatch": typeof lib_sanitizeSectionPatch;
  "lib/validateInspectionDraft": typeof lib_validateInspectionDraft;
  migrations: typeof migrations;
  n8nWebhook: typeof n8nWebhook;
  pdfs: typeof pdfs;
  sections: typeof sections;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
