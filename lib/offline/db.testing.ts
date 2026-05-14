/**
 * Utilidades **solo para tests** (Vitest). No importar desde código de app ni de `app/`.
 * Así `resetOfflineDbForTests` no entra en el grafo del bundle de producción.
 */
import { deleteDB } from "idb";
import {
  OFFLINE_DB_NAME,
  __closeOfflineDbConnectionForTesting,
  __resetOfflineDbMigrationDegradedForTests,
} from "./db";

/** Cierra conexión, invalida la promesa en memoria, borra la base y resetea el flag de migración. */
export async function resetOfflineDbForTests(): Promise<void> {
  __resetOfflineDbMigrationDegradedForTests();
  await __closeOfflineDbConnectionForTesting();
  await deleteDB(OFFLINE_DB_NAME).catch(() => undefined);
}
