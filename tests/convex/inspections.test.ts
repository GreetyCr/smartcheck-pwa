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

test("inspections.get: null si el documento no existe (p. ej. tras descartar)", async () => {
  const t = convexTest(schema, convexModules);

  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkId: clerkSubject,
      email: "get-null@example.com",
      role: "tecnico",
      approvalStatus: "approved",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({ subject: clerkSubject });
  const clientId = "dddddddd-bbbb-4ccc-bbbb-dddddddddddd";

  const created = await asUser.mutation(api.inspections.createOrUpdateFromDraft, {
    clientId,
    payload: { clientName: "Borrar" },
  });

  await asUser.mutation(api.sections.discardInspection, {
    inspectionId: created.inspectionId,
  });

  const gone = await asUser.query(api.inspections.get, {
    id: created.inspectionId,
  });
  expect(gone).toBeNull();
});

test("createOrUpdateFromDraft: photoManifest mapea vehicleFront a vehiclePhotoFront", async () => {
  const t = convexTest(schema, convexModules);

  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkId: clerkSubject,
      email: "photo-manifest@example.com",
      role: "tecnico",
      approvalStatus: "approved",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({ subject: clerkSubject });
  const clientId = "eeeeeeee-bbbb-4ccc-bbbb-eeeeeeeeeeee";

  let storageId: Id<"_storage"> = "" as Id<"_storage">;
  await t.run(async (ctx) => {
    storageId = await ctx.storage.store(new Blob(["x"]));
  });

  await asUser.mutation(api.inspections.createOrUpdateFromDraft, {
    clientId,
    payload: { clientName: "Fotos" },
    photoManifest: [
      {
        clientPhotoId: "local-photo-1",
        storageId,
        slot: "vehicleFront",
      },
    ],
  });

  const row = await asUser.query(api.inspections.getByClientId, { clientId });
  expect(row?.vehiclePhotoFront).toEqual(storageId);
  expect(row?.vehiclePhoto).toEqual(storageId);
});
