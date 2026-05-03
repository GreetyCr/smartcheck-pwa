import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

const inspectionStatus = v.union(
  v.literal("draft"),
  v.literal("completed"),
  v.literal("pending_sync"),
  v.literal("synced"),
  v.literal("report_delivered"),
);

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Métricas globales para el dashboard admin. */
export const getDashboardMetrics = query({
  args: { refresh: v.optional(v.number()) },
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const sod = startOfDay(now);
    const som = startOfMonth(now);

    const inspections = await ctx.db.query("inspections").collect();
    const users = await ctx.db.query("users").collect();

    const todayCount = inspections.filter((i) => i._creationTime >= sod).length;
    const monthCount = inspections.filter((i) => i._creationTime >= som).length;
    const pendingSyncCount = inspections.filter(
      (i) => i.status === "pending_sync",
    ).length;

    const techniciansCount = users.filter((u) => u.role === "tecnico").length;

    const clerkIdsThisMonth = new Set(
      inspections
        .filter((i) => i._creationTime >= som && i.clerkUserId)
        .map((i) => i.clerkUserId as string),
    );
    const activeTechnicians = clerkIdsThisMonth.size;

    const last7: { dayLabel: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const start = startOfDay(day.getTime());
      const end = start + 86400000;
      const count = inspections.filter(
        (insp) => insp._creationTime >= start && insp._creationTime < end,
      ).length;
      last7.push({
        dayLabel: day.toLocaleDateString("es-CR", {
          weekday: "short",
          day: "numeric",
        }),
        count,
      });
    }

    const byTech: Record<string, number> = {};
    for (const u of users) {
      if (u.role !== "tecnico") continue;
      byTech[u.clerkId] = 0;
    }
    for (const insp of inspections) {
      if (!insp.clerkUserId) continue;
      byTech[insp.clerkUserId] = (byTech[insp.clerkUserId] ?? 0) + 1;
    }
    const byTechnician = users
      .filter((u) => u.role === "tecnico")
      .map((u) => ({
        clerkId: u.clerkId,
        name: u.name ?? u.email,
        count: byTech[u.clerkId] ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const byStatus = {
      draft: 0,
      completed: 0,
      pending_sync: 0,
      synced: 0,
      report_delivered: 0,
    };
    for (const insp of inspections) {
      /** Alineado con UI: entrega registrada aunque `status` se haya degradado (p. ej. guardar borrador). */
      if (
        insp.reportDeliveredAt != null ||
        insp.status === "report_delivered"
      ) {
        byStatus.report_delivered++;
        continue;
      }
      const s = insp.status ?? "draft";
      if (s === "draft") byStatus.draft++;
      else if (s === "completed") byStatus.completed++;
      else if (s === "pending_sync") byStatus.pending_sync++;
      else if (s === "synced") byStatus.synced++;
    }

    return {
      todayCount,
      monthCount,
      pendingSyncCount,
      totalInspections: inspections.length,
      techniciansCount,
      activeTechnicians,
      last7Days: last7,
      byTechnician,
      byStatus,
    };
  },
});

/** Todas las inspecciones con datos del técnico (solo admin). */
export const listAllInspections = query({
  args: {
    status: v.optional(inspectionStatus),
    technicianClerkId: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    limit: v.optional(v.number()),
    refresh: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let rows = await ctx.db.query("inspections").order("desc").collect();

    if (args.status !== undefined) {
      rows = rows.filter((r) => {
        const s = r.status ?? "draft";
        if (args.status === "synced") {
          return s === "synced" || s === "report_delivered";
        }
        return s === args.status;
      });
    }
    if (args.technicianClerkId) {
      rows = rows.filter((r) => r.clerkUserId === args.technicianClerkId);
    }
    if (args.dateFrom !== undefined) {
      rows = rows.filter((r) => r._creationTime >= args.dateFrom!);
    }
    if (args.dateTo !== undefined) {
      rows = rows.filter((r) => r._creationTime <= args.dateTo!);
    }

    const cap = Math.min(Math.max(args.limit ?? 100, 1), 400);
    rows = rows.slice(0, cap);

    const usersList = await ctx.db.query("users").collect();
    const byClerk = new Map(usersList.map((u) => [u.clerkId, u]));

    return rows.map((insp) => {
      const tech = insp.clerkUserId
        ? byClerk.get(insp.clerkUserId)
        : undefined;
      return {
        inspection: insp,
        technicianName: tech?.name?.trim() || tech?.email || "Sin asignar",
        technicianEmail: tech?.email ?? "",
      };
    });
  },
});

/** Usuarios con conteo de inspecciones y última actividad (inspección más reciente). */
export const getTechniciansWithStats = query({
  args: { refresh: v.optional(v.number()) },
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const inspections = await ctx.db.query("inspections").collect();

    const lastByClerk: Record<string, number> = {};
    const countByClerk: Record<string, number> = {};

    for (const insp of inspections) {
      if (!insp.clerkUserId) continue;
      const id = insp.clerkUserId;
      countByClerk[id] = (countByClerk[id] ?? 0) + 1;
      const prev = lastByClerk[id] ?? 0;
      if (insp._creationTime > prev) lastByClerk[id] = insp._creationTime;
    }

    return users.map((u) => ({
      user: u,
      inspectionCount: countByClerk[u.clerkId] ?? 0,
      lastActivityAt: lastByClerk[u.clerkId] ?? null,
    }));
  },
});
