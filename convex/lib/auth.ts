import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/**
 * Admin siempre; técnico solo con `approvalStatus === "approved"` explícito.
 */
export function userHasFullAccess(user: Doc<"users">): boolean {
  if (user.role === "admin") return true;
  return user.approvalStatus === "approved";
}

/**
 * Usuario de la tabla `users` según el JWT de Clerk (`identity.subject`).
 */
export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/** Lanza si no hay sesión válida con Convex + Clerk. */
export async function requireAuth(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("No autenticado");
  return identity;
}

/**
 * Requiere fila en `users` (sincronizada vía webhook de Clerk).
 * Para comprobar solo por `clerkId` sin fila, usa `requireAuth` + `getCurrentUser`.
 */
export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  await requireAuth(ctx);
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error(
      "Usuario no sincronizado. Espera unos segundos o vuelve a iniciar sesión.",
    );
  }
  if (!userHasFullAccess(user)) {
    throw new Error(
      "Tu cuenta está pendiente de aprobación por un administrador.",
    );
  }
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw new Error("Se requiere rol de administrador");
  }
  return user;
}

/**
 * Técnico: solo sus inspecciones. Admin: todas.
 * Si aún no hay fila en `users`, se trata como técnico (solo propias).
 */
export async function canAccessInspection(
  ctx: Ctx,
  inspectionId: Id<"inspections">,
): Promise<boolean> {
  const inspection = await ctx.db.get(inspectionId);
  if (!inspection) return false;
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const user = await getCurrentUser(ctx);
  if (user?.role === "admin") return true;
  if (!user || !userHasFullAccess(user)) return false;
  return inspection.clerkUserId === identity.subject;
}

/** Inspección por `clientId` (índice `by_client_id`). */
export async function inspectionByClientId(
  ctx: Ctx,
  clientId: string,
): Promise<Doc<"inspections"> | null> {
  return await ctx.db
    .query("inspections")
    .withIndex("by_client_id", (q) => q.eq("clientId", clientId))
    .first();
}

/**
 * Misma regla que `canAccessInspection` pero por `clientId` público.
 * Usar en `getByClientId` y antes de patchear en `createOrUpdateFromDraft`.
 *
 * Convex no tiene índice único declarativo: la idempotencia real va en una sola mutación
 * con lectura + insert/patch; dos mutaciones concurrentes con el mismo `clientId` son raras
 * (UUID); si ocurren, documentar reintento en cliente.
 */
export async function canAccessInspectionByClientId(
  ctx: Ctx,
  clientId: string,
): Promise<boolean> {
  const doc = await inspectionByClientId(ctx, clientId);
  if (!doc) return false;
  return canAccessInspection(ctx, doc._id);
}

/** Exportar / generar PDF: admin o técnico aprobado. */
export function canExportPdf(user: Doc<"users"> | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "tecnico" && userHasFullAccess(user);
}
