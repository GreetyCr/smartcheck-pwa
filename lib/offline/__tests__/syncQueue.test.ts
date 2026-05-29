/**
 * @vitest-environment node
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  createEmptyPendingInspectionRow,
  getDB,
  putPendingInspectionRow,
  resetOfflineDbForTests,
  type PendingPhotoRow,
} from "@/lib/offline/db";
import { processSyncQueue, type SyncQueueAdapters } from "@/lib/offline/syncQueue";

const CLIENT_ID = "11111111-2222-4333-8444-555555555555";
const INSPECTION_ID = "inspection_id_test_001" as Id<"inspections">;

function makeAdapters(
  overrides: Partial<SyncQueueAdapters> = {},
): SyncQueueAdapters {
  const calls: {
    draft?: unknown;
    sections: string[];
    markSynced?: Id<"inspections">;
  } = { sections: [] };

  const base: SyncQueueAdapters = {
    generateUploadUrl: vi.fn(async () => "https://upload.test/post"),
    createOrUpdateFromDraft: vi.fn(async (args) => {
      calls.draft = args;
      return { inspectionId: INSPECTION_ID, created: true };
    }),
    ensureSectionRows: vi.fn(async () => undefined),
    upsertSection: vi.fn(async (args) => {
      calls.sections.push(args.sectionTable);
    }),
    markSynced: vi.fn(async (args) => {
      calls.markSynced = args.id;
    }),
  };

  return { ...base, ...overrides, ...({ __calls: calls } as object) } as SyncQueueAdapters;
}

describe("processSyncQueue", () => {
  beforeEach(async () => {
    await resetOfflineDbForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ storageId: "storage_photo_1" }),
      })) as unknown as typeof fetch,
    );
  });

  afterEach(async () => {
    await resetOfflineDbForTests();
    vi.unstubAllGlobals();
  });

  test("orden: createOrUpdateFromDraft → secciones → markSynced", async () => {
    const db = await getDB();
    const row = createEmptyPendingInspectionRow(CLIENT_ID);
    row.data = { clientName: "Ana", status: "draft" };
    row.sections = {
      section_motor: { nivel_aceite: { value: "bien" } },
    };
    await db.put("pendingInspections", row);

    const adapters = makeAdapters();
    const draftOrder: string[] = [];
    const sectionOrder: string[] = [];
    (adapters.createOrUpdateFromDraft as ReturnType<typeof vi.fn>).mockImplementation(
      async (args) => {
        draftOrder.push("draft");
        return { inspectionId: INSPECTION_ID, created: true };
      },
    );
    (adapters.upsertSection as ReturnType<typeof vi.fn>).mockImplementation(
      async (args) => {
        sectionOrder.push(args.sectionTable);
      },
    );

    const result = await processSyncQueue(adapters);

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);
    expect(draftOrder).toHaveLength(1);
    expect(sectionOrder).toContain("section_motor");
    expect(adapters.markSynced).toHaveBeenCalledWith({ id: INSPECTION_ID });

    const saved = await db.get("pendingInspections", CLIENT_ID);
    expect(saved?.syncStatus).toBe("synced");
    expect(saved?.convexId).toBe(INSPECTION_ID);
    expect(saved?.syncedAt).toBeTypeOf("number");
  });

  test("idempotencia: segunda corrida con fila synced no reprocesa", async () => {
    const db = await getDB();
    const row = createEmptyPendingInspectionRow(CLIENT_ID);
    row.syncStatus = "synced";
    row.convexId = INSPECTION_ID;
    row.syncedAt = Date.now();
    await db.put("pendingInspections", row);

    const adapters = makeAdapters();
    const result = await processSyncQueue(adapters);

    expect(result.processed).toBe(0);
    expect(adapters.createOrUpdateFromDraft).not.toHaveBeenCalled();
  });

  test("auto-sync omite filas en error cuando includeErrors es false", async () => {
    const db = await getDB();
    const row = createEmptyPendingInspectionRow(CLIENT_ID);
    row.syncStatus = "error";
    row.syncError = "fallo previo";
    row.data = { clientName: "Error previo" };
    await db.put("pendingInspections", row);

    const adapters = makeAdapters();
    const result = await processSyncQueue(adapters, { includeErrors: false });

    expect(result.processed).toBe(0);
    expect(adapters.createOrUpdateFromDraft).not.toHaveBeenCalled();
    const saved = await db.get("pendingInspections", CLIENT_ID);
    expect(saved?.syncStatus).toBe("error");
  });

  test("putPendingInspectionRow no embebe blobs en pendingInspections", async () => {
    const db = await getDB();
    const row = createEmptyPendingInspectionRow(CLIENT_ID);
    row.photos = [
      {
        id: "photo-front-1",
        inspectionLocalId: CLIENT_ID,
        sectionTable: "cabecera",
        itemKey: "vehicleFront",
        slot: "vehicleFront",
        blob: new Blob([new Uint8Array([1])], { type: "image/jpeg" }),
        createdAt: Date.now(),
        status: "pending",
      },
    ];
    await db.put("pendingPhotos", row.photos[0]!);
    await putPendingInspectionRow(row);

    const saved = await db.get("pendingInspections", CLIENT_ID);
    expect(saved?.photos).toEqual([]);
    const photo = await db.get("pendingPhotos", "photo-front-1");
    expect(photo?.blob).toBeInstanceOf(Blob);
  });

  test("sube foto de cabecera y envía photoManifest", async () => {
    const db = await getDB();
    const row = createEmptyPendingInspectionRow(CLIENT_ID);
    row.data = { clientName: "Con foto" };
    const photo: PendingPhotoRow = {
      id: "photo-front-1",
      inspectionLocalId: CLIENT_ID,
      sectionTable: "cabecera",
      itemKey: "vehicleFront",
      slot: "vehicleFront",
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
      createdAt: Date.now(),
      status: "pending",
    };
    await db.put("pendingPhotos", photo);
    await db.put("pendingInspections", row);

    const adapters = makeAdapters();
    await processSyncQueue(adapters);

    expect(adapters.createOrUpdateFromDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: CLIENT_ID,
        photoManifest: [
          expect.objectContaining({
            clientPhotoId: "photo-front-1",
            slot: "vehicleFront",
            storageId: "storage_photo_1",
          }),
        ],
      }),
    );
  });
});
