import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const adminSubject = "admin_migrations_test";
const techSubject = "tecnico_migrations_test";
const techDeniedSubject = "tecnico_migrations_denied";

test("backfillInspectionClientIds: asigna UUID solo donde falta; count en cero; idempotente", async () => {
  const t = convexTest(schema, convexModules);
  const now = Date.now();

  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkId: adminSubject,
      email: "admin-mig@example.com",
      role: "admin",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("users", {
      clerkId: techSubject,
      email: "tecnico-mig@example.com",
      role: "tecnico",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("inspections", {
      clerkUserId: techSubject,
      status: "draft",
      findingsCount: 0,
    });
    await ctx.db.insert("inspections", {
      clerkUserId: techSubject,
      clientId: "ffffffff-ffff-4fff-bfff-ffffffffffff",
      status: "draft",
      findingsCount: 0,
    });
    await ctx.db.insert("inspections", {
      clerkUserId: techSubject,
      clientId: "   ",
      status: "draft",
      findingsCount: 0,
    });
  });

  const asAdmin = t.withIdentity({ subject: adminSubject });

  expect(
    await asAdmin.query(api.migrations.countInspectionsMissingClientId, {}),
  ).toBe(2);

  const first = await asAdmin.mutation(
    api.migrations.backfillInspectionClientIds,
    {},
  );
  expect(first).toEqual({ scanned: 3, patched: 2, skipped: 1 });

  expect(
    await asAdmin.query(api.migrations.countInspectionsMissingClientId, {}),
  ).toBe(0);

  const rows = await t.run(async (ctx) =>
    ctx.db.query("inspections").collect(),
  );
  const clientIds = rows.map((r) => r.clientId).filter(Boolean);
  expect(clientIds).toHaveLength(3);
  expect(new Set(clientIds).size).toBe(3);

  const second = await asAdmin.mutation(
    api.migrations.backfillInspectionClientIds,
    {},
  );
  expect(second).toEqual({ scanned: 3, patched: 0, skipped: 3 });
});

test("backfillInspectionClientIds: técnico no admin no puede ejecutar", async () => {
  const t = convexTest(schema, convexModules);
  const now = Date.now();

  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkId: techDeniedSubject,
      email: "tecnico-only@example.com",
      role: "tecnico",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    });
  });

  const asTech = t.withIdentity({ subject: techDeniedSubject });
  await expect(
    asTech.mutation(api.migrations.backfillInspectionClientIds, {}),
  ).rejects.toThrow(/administrador/);
});
