/**
 * @vitest-environment node
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createEmptyPendingInspectionRow,
  getDB,
  resetOfflineDbForTests,
  type PendingPhotoRow,
} from "@/lib/offline/db";
import {
  LOCAL_ROW_METADATA_RETENTION_DAYS,
  runRetentionSweep,
  WIZARD_PURGE_BLOBS_AFTER_SYNC_DAYS,
} from "@/lib/offline/retention";

const DAY_MS = 86_400_000;
const CLIENT_ID = "aaaaaaaa-bbbb-4ccc-bbbb-aaaaaaaaaaaa";

function syncedRow(
  overrides: Partial<ReturnType<typeof createEmptyPendingInspectionRow>> = {},
) {
  const base = createEmptyPendingInspectionRow(CLIENT_ID);
  return {
    ...base,
    syncStatus: "synced" as const,
    syncedAt: Date.now(),
    data: {
      clientName: "Test",
      identifier: "RTL007",
      vehicleBrand: "Mazda",
    },
    sections: { section_motor: { items: {} } },
    wizard: { step: "done" },
    photos: [],
    ...overrides,
  };
}

async function insertPhoto(inspectionLocalId: string): Promise<void> {
  const db = await getDB();
  const photo: PendingPhotoRow = {
    id: `photo-${inspectionLocalId}`,
    inspectionLocalId,
    sectionTable: "cabecera",
    itemKey: "front",
    blob: new Blob(["x"], { type: "image/jpeg" }),
    createdAt: Date.now(),
    status: "uploaded",
  };
  await db.put("pendingPhotos", photo);
}

describe("runRetentionSweep", () => {
  beforeEach(async () => {
    await resetOfflineDbForTests();
  });

  afterEach(async () => {
    await resetOfflineDbForTests();
  });

  test("no toca filas synced recientes", async () => {
    const db = await getDB();
    const row = syncedRow({ syncedAt: Date.now() });
    await db.put("pendingInspections", row);

    const result = await runRetentionSweep(Date.now());
    expect(result.rowsTrimmed).toBe(0);
    expect(result.rowsDeleted).toBe(0);

    const saved = await db.get("pendingInspections", CLIENT_ID);
    expect(saved?.sections.section_motor).toBeDefined();
  });

  test("purga blobs y deja metadatos ligeros tras 7 días", async () => {
    const db = await getDB();
    const syncedAt = Date.now() - (WIZARD_PURGE_BLOBS_AFTER_SYNC_DAYS + 1) * DAY_MS;
    await db.put("pendingInspections", syncedRow({ syncedAt }));
    await insertPhoto(CLIENT_ID);

    const result = await runRetentionSweep(Date.now());
    expect(result.rowsTrimmed).toBe(1);
    expect(result.blobsPurged).toBeGreaterThanOrEqual(1);

    const saved = await db.get("pendingInspections", CLIENT_ID);
    expect(saved?.syncStatus).toBe("synced");
    expect(saved?.wizard).toBeUndefined();
    expect(Object.keys(saved?.sections ?? {})).toHaveLength(0);
    expect(saved?.photos).toHaveLength(0);
    expect(saved?.data.clientName).toBe("Test");
    expect(saved?.data.identifier).toBe("RTL007");

    const photosLeft = await db.getAllFromIndex(
      "pendingPhotos",
      "by-inspection",
      CLIENT_ID,
    );
    expect(photosLeft).toHaveLength(0);
  });

  test("elimina fila completa tras 30 días", async () => {
    const db = await getDB();
    const syncedAt =
      Date.now() - (LOCAL_ROW_METADATA_RETENTION_DAYS + 1) * DAY_MS;
    await db.put("pendingInspections", syncedRow({ syncedAt }));

    const result = await runRetentionSweep(Date.now());
    expect(result.rowsDeleted).toBe(1);

    const saved = await db.get("pendingInspections", CLIENT_ID);
    expect(saved).toBeUndefined();
  });

  test("no toca filas pending aunque sean antiguas", async () => {
    const db = await getDB();
    const row = createEmptyPendingInspectionRow("bbbbbbbb-bbbb-4ccc-bbbb-bbbbbbbbbbbb");
    row.updatedAt = Date.now() - 60 * DAY_MS;
    row.sections = { section_motor: {} };
    await db.put("pendingInspections", row);

    const result = await runRetentionSweep(Date.now());
    expect(result.rowsTrimmed).toBe(0);
    expect(result.rowsDeleted).toBe(0);

    const saved = await db.get("pendingInspections", row.localId);
    expect(saved?.syncStatus).toBe("pending");
    expect(Object.keys(saved?.sections ?? {})).toHaveLength(1);
  });
});
