import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

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
  return inspection.clerkUserId === identity.subject;
}

/** Exportar PDF: solo admin (según matriz de permisos). */
export function canExportPdf(user: Doc<"users"> | null): boolean {
  return user?.role === "admin";
}
