import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
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
  /** `"cabecera"` para fotos de cabecera; tabla de sección para ítems. */
  sectionTable: string;
  itemKey: string;
  /** Solo cabecera: slot de `photoManifest` (Fase 5). */
  slot?: string;
  blob: Blob;
  createdAt: number;
  status: "pending" | "uploading" | "uploaded" | "error";
  uploadedUrl?: string;
  storageId?: string;
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
  syncStatus: "pending" | "uploading" | "syncing" | "synced" | "error";
  syncError?: string;
  /** Marca de sync exitosa (retención Fase 7). */
  syncedAt?: number;
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

/** Solo tests. */
export function __resetOfflineDbMigrationDegradedForTests(): void {
  offlineDbMigrationDegraded = false;
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

function stripNonJsonable(value: unknown): unknown {
  if (typeof Blob !== "undefined" && value instanceof Blob) return undefined;
  if (typeof File !== "undefined" && value instanceof File) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((v) => stripNonJsonable(v))
      .filter((v) => v !== undefined);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const s = stripNonJsonable(v);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return value;
}

/**
 * Filas de inspección en IDB: metadatos only. Los blobs viven en `pendingPhotos`.
 * Re-escribir blobs embebidos en `photos[]` falla en algunos motores IDB al sync.
 */
export function inspectionRowForStore(
  row: PendingInspectionRow,
): PendingInspectionRow {
  return {
    ...row,
    photos: [],
    data: stripNonJsonable(row.data) as InspectionData,
    sections: stripNonJsonable(row.sections) as Record<string, SectionData>,
    wizard:
      row.wizard === undefined
        ? undefined
        : (stripNonJsonable(row.wizard) as WizardDraftBlob),
  };
}

export async function putPendingInspectionRow(
  row: PendingInspectionRow,
): Promise<void> {
  const db = await getDB();
  await db.put("pendingInspections", inspectionRowForStore(row));
}

export {
  deletePendingPhoto,
  patchPendingPhoto,
  putPendingPhotoRow,
  rehydratePhotoBlob,
} from "@/lib/offline/idbPhotos";

/** Quita blobs embebidos legacy en `photos[]` de filas ya existentes. */
export async function normalizeEmbeddedInspectionPhotos(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll("pendingInspections");
  let fixed = 0;
  for (const row of all) {
    if (row.photos.length === 0) continue;
    await putPendingInspectionRow(row);
    fixed += 1;
  }
  return fixed;
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
          await tx.store.put(ensureClientIdOnRow(inspectionRowForStore(row)));
        }
      } catch (rowErr) {
        console.error("[smartcheck IDB v2 migration] fila", row.localId, rowErr);
      }
    }
    await tx.done;
    offlineDbMigrationDegraded = false;
  } catch (e) {
    console.error("[smartcheck IDB v2 migration] transacción", e);
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
    }).then(async (db) => {
      await migratePendingInspectionsClientIds(db);
      return db;
    });
  }
  return dbPromise;
}

/**
 * Cierra la instancia en memoria y borra la base (solo tests).
 */
export async function resetOfflineDbForTests(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  offlineDbMigrationDegraded = false;
  if (pending) {
    try {
      const db = await pending;
      db.close();
    } catch {
      /* ignore */
    }
  }
  await deleteDB(DB_NAME).catch(() => undefined);
}

/**
 * @deprecated Usar getDB. Alias para código que aún use openDb (p. ej. cola de fotos).
 * Devuelve la instancia `idb` en lugar de IDB crudo.
 */
export function openDb(): ReturnType<typeof getDB> {
  return getDB();
}

export async function countPendingInspections(): Promise<number> {
  const unified = await listInspectionRowsForSyncQueue();
  const db = await getDB();
  const pending = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "pending",
  );
  const errored = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "error",
  );
  const legacyOnly = [...pending, ...errored].filter((row) => !row.clientId);
  const seen = new Set(unified.map((r) => r.localId));
  let total = unified.length;
  for (const row of legacyOnly) {
    if (!seen.has(row.localId)) total += 1;
  }
  return total;
}

/** Fotos locales que aún requieren subida a Convex. */
export async function countOutstandingPhotosForInspection(
  inspectionLocalId: string,
): Promise<number> {
  const photos = await listPendingPhotosForInspection(inspectionLocalId);
  return photos.filter(
    (p) =>
      p.status === "pending" ||
      p.status === "uploading" ||
      (p.status === "error" && !p.storageId),
  ).length;
}

/**
 * Inspección ya vive en Convex y no hay fotos/secciones locales pendientes:
 * deja de contar para auto-sync (evita sync fantasma en flujo online).
 */
export async function reconcileConvexBackedLocalRow(
  row: PendingInspectionRow,
): Promise<boolean> {
  if (!row.convexId) return false;
  const outstanding = await countOutstandingPhotosForInspection(row.localId);
  const hasLocalSections = Object.keys(row.sections).length > 0;
  if (outstanding > 0 || hasLocalSections) return false;
  if (row.syncStatus === "synced") return false;

  await putPendingInspectionRow({
    ...row,
    syncStatus: "synced",
    syncError: undefined,
    syncedAt: row.syncedAt ?? Date.now(),
    sections: {},
    wizard: undefined,
  });
  return true;
}

/** Filas que deben disparar auto-sync (excluye `error` para evitar loops). */
export async function countAutoSyncPendingInspections(): Promise<number> {
  const db = await getDB();
  const statuses: Array<"pending" | "uploading" | "syncing"> = [
    "pending",
    "uploading",
    "syncing",
  ];
  let total = 0;
  for (const status of statuses) {
    const batch = await db.getAllFromIndex(
      "pendingInspections",
      "by-status",
      status,
    );
    for (const row of batch) {
      if (!row.clientId) continue;
      if (await reconcileConvexBackedLocalRow(row)) continue;
      total += 1;
    }
  }
  const pending = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "pending",
  );
  const legacyOnly = pending.filter((row) => !row.clientId);
  total += legacyOnly.length;
  return total;
}

export async function listPendingInspectionsByStatus(
  status: PendingInspectionRow["syncStatus"],
): Promise<PendingInspectionRow[]> {
  const db = await getDB();
  return db.getAllFromIndex("pendingInspections", "by-status", status);
}

/** Filas con trabajo pendiente para la cola unificada (Fase 5). */
export async function listInspectionRowsForSyncQueue(): Promise<
  PendingInspectionRow[]
> {
  const db = await getDB();
  const pending = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "pending",
  );
  const uploading = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "uploading",
  );
  const syncing = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "syncing",
  );
  const errored = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "error",
  );
  return [...pending, ...uploading, ...syncing, ...errored];
}

/** Inspecciones locales aún no sincronizadas (UI Fase 6). Incluye `syncing`. */
export async function listUnsyncedInspections(): Promise<PendingInspectionRow[]> {
  const db = await getDB();
  const statuses: PendingInspectionRow["syncStatus"][] = [
    "pending",
    "uploading",
    "syncing",
    "error",
  ];
  const rows: PendingInspectionRow[] = [];
  for (const status of statuses) {
    const batch = await db.getAllFromIndex(
      "pendingInspections",
      "by-status",
      status,
    );
    rows.push(...batch);
  }
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function countSyncQueueErrors(): Promise<number> {
  const db = await getDB();
  const errored = await db.getAllFromIndex(
    "pendingInspections",
    "by-status",
    "error",
  );
  return errored.length;
}

export async function listPendingPhotosForInspection(
  inspectionLocalId: string,
): Promise<PendingPhotoRow[]> {
  const db = await getDB();
  return db.getAllFromIndex("pendingPhotos", "by-inspection", inspectionLocalId);
}
