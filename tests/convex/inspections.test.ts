import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const clerkSubject = "user_test_pr_b_convex";

test("createOrUpdateFromDraft: misma clientId la segunda vez patchea, no inserta", async () => {
  const t = convexTest(schema, convexModules);

  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkId: clerkSubject,
      email: "convex-test@example.com",
      role: "tecnico",
      approvalStatus: "approved",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({ subject: clerkSubject });
  const clientId = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";

  const first = await asUser.mutation(api.inspections.createOrUpdateFromDraft, {
    clientId,
    payload: { clientName: "Primera" },
  });
  expect(first.created).toBe(true);

  const second = await asUser.mutation(api.inspections.createOrUpdateFromDraft, {
    clientId,
    payload: { clientName: "Segunda" },
  });
  expect(second.created).toBe(false);
  expect(second.inspectionId).toEqual(first.inspectionId);

  const row = await asUser.query(api.inspections.getByClientId, { clientId });
  expect(row?.clientName).toBe("Segunda");
});
