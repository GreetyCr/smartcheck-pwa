import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "smartcheck-pwa-offline";
const DB_VERSION = 1;

/** Formulario y cabecera de inspección (misma forma que el patch de Convex, sin _id). */
export type InspectionData = Record<string, unknown>;

export type SectionData = Record<string, unknown>;

export type PendingPhotoRow = {
  id: string;
  inspectionLocalId: string;
  sectionTable: string;
  itemKey: string;
  blob: Blob;
  createdAt: number;
  status: "pending" | "uploading" | "uploaded" | "error";
  uploadedUrl?: string;
  syncError?: string;
};

export type PendingInspectionRow = {
  localId: string;
  convexId?: string;
  data: InspectionData;
  sections: Record<string, SectionData>;
  /** Alias usado por cola de fotos; mantener alineado con módulo 3.1 */
  photos: PendingPhotoRow[];
  createdAt: number;
  updatedAt: number;
  syncStatus: "pending" | "syncing" | "synced" | "error";
  syncError?: string;
};

export type CacheEntry = {
  key: string;
  data: unknown;
  timestamp: number;
};

interface SmartcheckDB extends DBSchema {
  pendingInspections: {
    key: string;
    value: PendingInspectionRow;
    indexes: { "by-status": string; "by-updated": number };
  };
  pendingPhotos: {
    key: string;
    value: PendingPhotoRow;
    indexes: { "by-inspection": string; "by-status": string };
  };
  cache: {
    key: string;
    value: CacheEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<SmartcheckDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<SmartcheckDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SmartcheckDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
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
      },
    });
  }
  return dbPromise;
}

/**
 * @deprecated Usar getDB. Alias para código que aún use openDb (p. ej. cola de fotos).
 * Devuelve la instancia `idb` en lugar de IDB crudo.
 */
export function openDb(): ReturnType<typeof getDB> {
  return getDB();
}

export async function countPendingInspections(): Promise<number> {
  const db = await getDB();
  const all = await db.getAllFromIndex("pendingInspections", "by-status", "pending");
  return all.length;
}

export async function listPendingInspectionsByStatus(
  status: PendingInspectionRow["syncStatus"],
): Promise<PendingInspectionRow[]> {
  const db = await getDB();
  return db.getAllFromIndex("pendingInspections", "by-status", status);
}
