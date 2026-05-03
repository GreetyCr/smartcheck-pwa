import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import {
  canExportPdf,
  getCurrentUser,
  requireAdmin,
} from "./lib/auth";

/** Sincronización desde webhook Clerk (`user.created` / `user.updated`). */
export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
        updatedAt: now,
      });
      return existing._id;
    }

    const anyUser = await ctx.db.query("users").take(1);
    const isFirst = anyUser.length === 0;
    const role = isFirst ? "admin" : "tecnico";
    const approvalStatus = isFirst ? ("approved" as const) : ("pending" as const);

    return await ctx.db.insert("users", {
      ...args,
      role,
      approvalStatus,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Eliminación lógica en Clerk → borrar fila local. */
export const deleteByClerkId = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const u = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (u) await ctx.db.delete(u._id);
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

/** Lista de usuarios (solo admin). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").collect();
  },
});

/** Indica si el usuario actual puede exportar PDF (solo admin). */
export const exportPdfAllowed = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return canExportPdf(user);
  },
});

export const promoteToAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const now = Date.now();
    await ctx.db.patch(userId, {
      role: "admin",
      approvalStatus: "approved",
      updatedAt: now,
    });
  },
});

/** Aprueba el acceso de un técnico pendiente (tras alta por sign-up). */
export const approveTechnician = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("Usuario no encontrado");
    const now = Date.now();
    await ctx.db.patch(userId, {
      approvalStatus: "approved",
      updatedAt: now,
    });
  },
});

/** Cantidad de cuentas esperando aprobación (solo admin). */
export const pendingApprovalCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("users").collect();
    return rows.filter(
      (u) => u.role !== "admin" && u.approvalStatus === "pending",
    ).length;
  },
});

/** Revoca rol admin (vuelve a técnico). No permite quedar sin admins. */
export const demoteToTechnician = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const actor = await requireAdmin(ctx);
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("Usuario no encontrado");
    if (target._id === actor._id) {
      throw new Error("No puedes quitarte el rol de administrador a ti mismo.");
    }
    if (target.role !== "admin") {
      return;
    }
    const all = await ctx.db.query("users").collect();
    const adminCount = all.filter((u) => u.role === "admin").length;
    if (adminCount <= 1) {
      throw new Error("Debe existir al menos un administrador.");
    }
    const now = Date.now();
    await ctx.db.patch(userId, { role: "tecnico", updatedAt: now });
  },
});
