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
import type * as http from "../http.js";
import type * as inspections from "../inspections.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_n8nSchedule from "../lib/n8nSchedule.js";
import type * as lib_sanitizeSectionPatch from "../lib/sanitizeSectionPatch.js";
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
  http: typeof http;
  inspections: typeof inspections;
  "lib/auth": typeof lib_auth;
  "lib/n8nSchedule": typeof lib_n8nSchedule;
  "lib/sanitizeSectionPatch": typeof lib_sanitizeSectionPatch;
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
