/**
 * @vitest-environment node
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { openDB } from "idb";
import {
  OFFLINE_DB_NAME,
  getDB,
  migratePendingInspectionsClientIds,
  resetOfflineDbForTests,
  type PendingInspectionRow,
} from "@/lib/offline/db";

function createV1Stores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains("pendingInspections")) {
    const insp = db.createObjectStore("pendingInspections", {
      keyPath: "localId",
    });
    insp.createIndex("by-status", "syncStatus");
    insp.createIndex("by-updated", "updatedAt");
  }
  if (!db.objectStoreNames.contains("pendingPhotos")) {
    const ph = db.createObjectStore("pendingPhotos", { keyPath: "id" });
    ph.createIndex("by-inspection", "inspectionLocalId");
    ph.createIndex("by-status", "status");
  }
  if (!db.objectStoreNames.contains("cache")) {
    db.createObjectStore("cache", { keyPath: "key" });
  }
}

async function seedV1DbWithoutClientIds(rowCount: number) {
  await resetOfflineDbForTests();
  const dbv1 = await openDB(OFFLINE_DB_NAME, 1, {
    upgrade(db) {
      createV1Stores(db);
    },
  });
  const statuses: PendingInspectionRow["syncStatus"][] = [
    "pending",
    "syncing",
    "synced",
    "error",
  ];
  const tx = dbv1.transaction("pendingInspections", "readwrite");
  for (let i = 0; i < rowCount; i++) {
    const localId = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const now = Date.now() + i;
    const row: PendingInspectionRow = {
      localId,
      data: { idx: i },
      sections: {},
      photos: [],
      createdAt: now,
      updatedAt: now,
      syncStatus: statuses[i % statuses.length]!,
      syncError: i % 5 === 0 ? "x" : undefined,
    };
    await tx.store.put(row);
  }
  await tx.done;
  dbv1.close();
}

describe("IDB migración v2 (clientId)", () => {
  beforeEach(async () => {
    await resetOfflineDbForTests();
  });
  afterEach(async () => {
    await resetOfflineDbForTests();
  });

  test("DB vacía: getDB no falla", async () => {
    await resetOfflineDbForTests();
    const db = await getDB();
    const all = await db.getAll("pendingInspections");
    expect(all).toEqual([]);
  });

  test("fila legacy sin clientId recibe clientId === localId", async () => {
    await seedV1DbWithoutClientIds(1);
    const db = await getDB();
    const row = await db.get("pendingInspections", "00000000-0000-4000-8000-000000000000");
    expect(row?.clientId).toBe(row?.localId);
  });

  test("20 filas en estados mixtos migran sin perder datos", async () => {
    await seedV1DbWithoutClientIds(20);
    const db = await getDB();
    const all = await db.getAll("pendingInspections");
    expect(all).toHaveLength(20);
    for (const r of all) {
      expect(r.clientId).toBe(r.localId);
      expect((r.data as { idx?: number }).idx).toBeDefined();
    }
  });

  test("idempotencia: segunda migración no rompe filas ya migradas", async () => {
    await seedV1DbWithoutClientIds(3);
    const db = await getDB();
    await migratePendingInspectionsClientIds(db);
    const before = await db.get("pendingInspections", "00000000-0000-4000-8000-000000000000");
    await migratePendingInspectionsClientIds(db);
    const after = await db.get("pendingInspections", "00000000-0000-4000-8000-000000000000");
    expect(after?.clientId).toBe(before?.clientId);
    expect(after?.updatedAt).toBe(before?.updatedAt);
  });

  test("fila con clientId ya set no se sobreescribe", async () => {
    await resetOfflineDbForTests();
    const dbv1 = await openDB(OFFLINE_DB_NAME, 1, {
      upgrade(db) {
        createV1Stores(db);
      },
    });
    const localId = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    const preset = "ffffffff-ffff-4fff-ffff-ffffffffffff" as unknown as import("@/lib/types/clientId").ClientId;
    await dbv1.put("pendingInspections", {
      localId,
      clientId: preset,
      data: {},
      sections: {},
      photos: [],
      createdAt: 1,
      updatedAt: 1,
      syncStatus: "pending",
    });
    dbv1.close();

    const db = await getDB();
    const row = await db.get("pendingInspections", localId);
    expect(row?.clientId).toBe(preset);
  });
});
