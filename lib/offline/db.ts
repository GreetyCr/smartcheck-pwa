import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ClientId } from "@/lib/types/clientId";
import { ClientId as toClientId } from "@/lib/types/clientId";

export const OFFLINE_DB_NAME = "smartcheck-pwa-offline";

const DB_NAME = OFFLINE_DB_NAME;
const DB_VERSION = 2;

/** Formulario y cabecera de inspección (misma forma que el patch de Convex, sin _id). */
export type InspectionData = Record<string, unknown>;

export type SectionData = Record<string, unknown>;

export type WizardDraftBlob = Record<string, unknown>;

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

/**
 * Fila de inspección pendiente en IndexedDB.
 *
 * **Invariante (Fase 2+):** `localId === (clientId as string)` siempre que `clientId` exista.
 * `keyPath` sigue siendo solo `localId` (sin migración destructiva de clave).
 */
export type PendingInspectionRow = {
  localId: string;
  /** Opcional solo en datos legacy previos a migración v2; tras migración siempre presente. */
  clientId?: ClientId;
  convexId?: string;
  data: InspectionData;
  sections: Record<string, SectionData>;
  /** Alias usado por cola de fotos; mantener alineado con módulo 3.1 */
  photos: PendingPhotoRow[];
  /** Estado del wizard local-first (campos aditivos; Fase 3+). */
  wizard?: WizardDraftBlob;
  createdAt: number;
  updatedAt: number;
  syncStatus: "pending" | "syncing" | "synced" | "error";
  syncError?: string;
};

export type PendingInspectionDraftPatch = {
  data?: Partial<InspectionData>;
  sections?: Partial<Record<string, SectionData>>;
  wizard?: Partial<WizardDraftBlob>;
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

let offlineDbMigrationDegraded = false;

/** True si la migración v2 falló en esta carga: modo degradado (solo lectura recomendado en el hook). */
export function getOfflineDbMigrationDegraded(): boolean {
  return offlineDbMigrationDegraded;
}

/** @internal Solo tests / `lib/offline/db.testing.ts`. No usar en app. */
export function __resetOfflineDbMigrationDegradedForTests(): void {
  offlineDbMigrationDegraded = false;
}

/**
 * Cierra la conexión y anula la promesa cacheada.
 * @internal Solo `lib/offline/db.testing.ts`.
 */
export async function __closeOfflineDbConnectionForTesting(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) {
    try {
      const db = await pending;
      db.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Crea una fila vacía con `clientId === localId` (UUID v4 recomendado como `localId`).
 */
export function createEmptyPendingInspectionRow(localId: string): PendingInspectionRow {
  const now = Date.now();
  return {
    localId,
    clientId: toClientId(localId),
    data: {},
    sections: {},
    photos: [],
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  };
}

/**
 * Garantiza la invariante `localId === clientId` sin pisar un `clientId` ya migrado.
 */
export function ensureClientIdOnRow(row: PendingInspectionRow): PendingInspectionRow {
  if (row.clientId && row.clientId === row.localId) return row;
  if (row.clientId && row.clientId !== row.localId) {
    console.warn(
      "[smartcheck offline] clientId !== localId; se fuerza clientId = localId",
      row.localId,
    );
  }
  return { ...row, clientId: toClientId(row.localId) };
}

/**
 * Merge **aditivo** para coalescer saves bajo debounce (último estado gana por campo).
 * Documentado en `usePendingInspectionDraft`: una sola escritura `put` con el último merge.
 */
export function mergePendingInspectionDraftPatch(
  row: PendingInspectionRow,
  patch: PendingInspectionDraftPatch,
): PendingInspectionRow {
  const now = Date.now();
  return {
    ...row,
    data: patch.data ? { ...row.data, ...patch.data } : row.data,
    sections: patch.sections
      ? ({ ...row.sections, ...patch.sections } as Record<string, SectionData>)
      : row.sections,
    wizard:
      patch.wizard === undefined
        ? row.wizard
        : { ...(row.wizard ?? {}), ...patch.wizard },
    updatedAt: now,
  };
}

/**
 * Migración idempotente: solo añade `clientId` donde falta (`clientId = localId`).
 * No renombra ni borra campos. Si una fila ya tiene `clientId`, no se toca.
 *
 * Se ejecuta tras cada `openDB` exitoso (coste O(n) en filas; aceptable para n pequeño).
 * Errores: se registran y activan modo degradado; no se lanza para no bloquear `getDB`.
 */
export async function migratePendingInspectionsClientIds(
  db: IDBPDatabase<SmartcheckDB>,
): Promise<void> {
  try {
    const all = await db.getAll("pendingInspections");
    const tx = db.transaction("pendingInspections", "readwrite");
    for (const row of all) {
      try {
        if (!row.clientId) {
          await tx.store.put(ensureClientIdOnRow(row));
        }
      } catch (rowErr) {
        console.error("[offline-db] migration_row_failed", row.localId, rowErr);
      }
    }
    await tx.done;
    offlineDbMigrationDegraded = false;
  } catch (e) {
    console.error("[offline-db] migration_degraded", "transaction_failed", e);
    offlineDbMigrationDegraded = true;
  }
}

function createSchemaV1(db: IDBPDatabase<SmartcheckDB>) {
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

export function getDB(): Promise<IDBPDatabase<SmartcheckDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SmartcheckDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          createSchemaV1(db);
        }
        if (oldVersion < 2) {
          // Solo subida de versión: los campos nuevos son opcionales a nivel JS/TS.
          // La migración de datos corre post-open en `migratePendingInspectionsClientIds`.
        }
      },
      blocked(currentVersion, blockedVersion, _event) {
        console.warn(
          "[offline-db] idb_blocked",
          "Otra pestaña mantiene IndexedDB abierta; cerrá las demás o recargá.",
          { currentVersion, blockedVersion },
        );
        console.error(
          "[offline-db] migration_degraded",
          "idb_blocked_pending_upgrade",
          { currentVersion, blockedVersion },
        );
        offlineDbMigrationDegraded = true;
      },
    }).then(async (db) => {
      await migratePendingInspectionsClientIds(db);
      return db;
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
