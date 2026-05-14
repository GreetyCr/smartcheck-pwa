import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import {
  createEmptyPendingInspectionRow,
  getDB,
  OFFLINE_DB_NAME,
} from "@/lib/offline/db";
import { resetOfflineDbForTests } from "@/lib/offline/db.testing";
import { ClientId as toClientId } from "@/lib/types/clientId";

describe("IDB invariantes localId === clientId", () => {
  beforeEach(async () => {
    await resetOfflineDbForTests();
  });
  afterEach(async () => {
    await resetOfflineDbForTests();
  });

  test("createEmptyPendingInspectionRow cumple la invariante", () => {
    const id = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
    const row = createEmptyPendingInspectionRow(id);
    expect(row.localId).toBe(id);
    expect(row.clientId as string).toBe(id);
  });

  test("tras migración v2, fila legacy cumple la invariante", async () => {
    await resetOfflineDbForTests();
    const dbv1 = await openDB(OFFLINE_DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pendingInspections")) {
          const insp = db.createObjectStore("pendingInspections", {
            keyPath: "localId",
          });
          insp.createIndex("by-status", "syncStatus");
          insp.createIndex("by-updated", "updatedAt");
        }
      },
    });
    const localId = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
    await dbv1.put("pendingInspections", {
      localId,
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
    expect(row?.localId).toBe(row?.clientId as string);
  });

  test("getDB + fila nueva vía ClientId mantiene invariante", async () => {
    const id = toClientId("dddddddd-dddd-4ddd-dddd-dddddddddddd");
    const db = await getDB();
    const row = createEmptyPendingInspectionRow(id as string);
    await db.put("pendingInspections", row);
    const read = await db.get("pendingInspections", id as string);
    expect(read?.localId).toBe(read?.clientId as string);
  });
});
