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

    /**
     * **«Ya subida» es «ya subida», no «ya subida o entregada» — A150.**
     *
     * Este filtro ensanchaba `synced` a `synced || report_delivered`. En el
     * panel eso es un error, porque el selector ofrece **las dos por separado**:
     * elegir «Ya subida» devolvía filas cuya propia insignia decía «INFORME
     * ENTREGADO», y las dos opciones se solapaban sin decirlo.
     *
     * Medido en producción el 6-set: de 172 revisiones en la app, **170 están
     * entregadas y solo 2 subidas sin entregar**. O sea que el filtro devolvía
     * 172 donde el rótulo prometía 2, y el desglose de la portada —que sí cuenta
     * estricto— mostraba 2 al lado. **Mismo rótulo, dos universos** (A133 · A148
     * · A149).
     *
     * Y es justo el corte que le sirve a Esteban: «subidas pero sin informe
     * entregado» es su lista de pendientes; «todo lo que llegó al servidor» ya
     * lo contesta «Todos los estados».
     *
     * **En `inspections.ts:list` el ensanche se queda y es correcto:** ahí filtra
     * la app del técnico, cuyos chips **no tienen** «Informe entregado», así que
     * sin el ensanche las entregadas desaparecerían de su lista. La diferencia
     * es deliberada — no unificar.
     */
    if (args.status !== undefined) {
      rows = rows.filter((r) => (r.status ?? "draft") === args.status);
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

    /**
     * **El conteo se toma ANTES de recortar** — A114.
     *
     * La página pedía 150 filas y mostraba «Suma de N inspecciones del filtro
     * actual» con el largo de lo que recibía. Al pasar de 150 revisiones en la
     * app —eran 164 el 1-set-2026 y 172 el 6-set— empezó a informar 150 como si fuera el total: no era una
     * lista incompleta, era un **número equivocado**, y encima uno que se
     * quedaba quieto mientras el negocio crecía. El tope sigue existiendo
     * porque la tabla no puede pintar miles de filas, pero ahora la pantalla
     * sabe cuántas hay de verdad y puede decir que está mostrando una parte.
     */
    const totalMatched = rows.length;
    /**
     * **El cobro total del filtro, ANTES de recortar — A146.**
     *
     * La pantalla lo sumaba del lado del cliente sobre las filas recibidas, que
     * son a lo sumo `cap`. Con el tope alcanzado mostraba el total **de las 400
     * pintadas** rotulado «Total cobrado», que se lee como el total del filtro.
     * Es el mismo error que A114 arregló para el conteo de filas, sobreviviendo
     * en el monto — y un monto equivocado se copia a una hoja y nadie lo vuelve
     * a cuestionar.
     *
     * Se suma acá, donde están todas las filas que pasaron el filtro.
     */
    const totalChargedCRC = rows.reduce((sum, r) => {
      const amount = r.totalAmountCharged;
      return amount != null && Number.isFinite(amount) ? sum + amount : sum;
    }, 0);

    const cap = Math.min(Math.max(args.limit ?? 100, 1), 1000);
    rows = rows.slice(0, cap);

    const usersList = await ctx.db.query("users").collect();
    const byClerk = new Map(usersList.map((u) => [u.clerkId, u]));

    return {
      totalMatched,
      totalChargedCRC,
      truncated: totalMatched > rows.length,
      rows: rows.map((insp) => {
        const tech = insp.clerkUserId
          ? byClerk.get(insp.clerkUserId)
          : undefined;
        return {
          inspection: insp,
          technicianName: tech?.name?.trim() || tech?.email || "Sin asignar",
          technicianEmail: tech?.email ?? "",
        };
      }),
    };
  },
});

/**
 * Usuarios con su conteo de revisiones y la fecha de su **revisión más
 * reciente** — no un ingreso al sistema, que no se registra en ningún lado
 * (A151). La columna se llama «Última revisión» por eso.
 */
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
