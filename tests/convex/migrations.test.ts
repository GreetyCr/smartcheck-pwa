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
  expect(first).toMatchObject({
    scanned: 3,
    patched: 2,
    skipped: 1,
    errors: [],
    done: true,
  });
  expect(first.nextCursor).toBeUndefined();

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
  expect(second).toMatchObject({
    scanned: 3,
    patched: 0,
    skipped: 3,
    errors: [],
    done: true,
  });
});

test("backfillInspectionClientIds: repite con cursor hasta done (tandas pequeñas)", async () => {
  const t = convexTest(schema, convexModules);
  const now = Date.now();

  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkId: adminSubject,
      email: "admin-mig-batch@example.com",
      role: "admin",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("users", {
      clerkId: techSubject,
      email: "tecnico-mig-batch@example.com",
      role: "tecnico",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    });
    for (let i = 0; i < 5; i++) {
      await ctx.db.insert("inspections", {
        clerkUserId: techSubject,
        status: "draft",
        findingsCount: 0,
      });
    }
  });

  const asAdmin = t.withIdentity({ subject: adminSubject });
  expect(
    await asAdmin.query(api.migrations.countInspectionsMissingClientId, {}),
  ).toBe(5);

  let cursor: string | null = null;
  let totalPatched = 0;
  let sawDone = false;
  for (let step = 0; step < 20; step++) {
    const r = await asAdmin.mutation(api.migrations.backfillInspectionClientIds, {
      cursor,
      batchSize: 2,
    });
    totalPatched += r.patched;
    expect(r.errors).toEqual([]);
    if (r.done) {
      expect(r.nextCursor).toBeUndefined();
      sawDone = true;
      break;
    }
    expect(r.nextCursor).toBeDefined();
    cursor = r.nextCursor!;
  }

  expect(sawDone).toBe(true);
  expect(totalPatched).toBe(5);
  expect(
    await asAdmin.query(api.migrations.countInspectionsMissingClientId, {}),
  ).toBe(0);
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
