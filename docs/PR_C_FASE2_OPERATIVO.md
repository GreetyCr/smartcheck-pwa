# PR-C / Fase 2 — Operativo (borrador local IndexedDB)

Este documento resume el alcance **PR-C** y las reglas que el team lead dejó para evitar sorpresas en producción. **No sustituye** `docs/MIGRACION_LOCAL_FIRST_CHECKLIST.md`.

## Alcance PR-C (infra aislada)

- `lib/offline/db.ts`: versión **2**, migración **aditiva** e **idempotente** (`clientId` solo si falta; nunca pisar `clientId` existente).
- `lib/types/clientId.ts`: tipo **branded** `ClientId`.
- `hooks/usePendingInspectionDraft.ts`: debounce con **coalescer** (un solo `put` con último estado), `flush()`, `pagehide` (`persisted === false`) y `visibilitychange` (`hidden`); en lifecycle **sin** `await` del `put`.
- Tests: `lib/offline/__tests__/db-migration-v2.test.ts`, `db-invariants.test.ts`, `hooks/__tests__/usePendingInspectionDraft.test.tsx` (`fake-indexeddb`, `happy-dom`).

## Qué NO tocar en este PR

- `VehicleForm.tsx`, `ClientForm.tsx`, `InspectionWizard.tsx` / layout wizard (Fase 3 + flag).
- `SyncContext.tsx`, `lib/offline/sync.ts`.
- `useOfflineInspection` (convive hasta limpieza final).
- **Cero UI nueva** ni cambios visibles: si QA ve comportamiento distinto tras merge, es **bug**.

## Comunicación a QA

**PR-C no introduce cambio de comportamiento observable** hasta que un padre use `usePendingInspectionDraft`. El hook puede mergearse sin esperar al backfill Convex de `clientId`; `clientId` en Convex sigue `v.optional()`.

## Riesgo y degradación

Si la migración IDB falla en un navegador raro: se registra error, `getOfflineDbMigrationDegraded()` pasa a `true` y el hook entra en **solo lectura** (no bloquear el wizard entero).

## Catálogo de logs `[offline-db]` (cliente)

Formato: prefijo **`[offline-db]`** + tipo + razón o contexto (greppable; apto para mapear a tags en Sentry u otro APM). Detalle breve en [`lib/offline/README.md`](../lib/offline/README.md).

| Log | Significado |
|-----|-------------|
| `[offline-db] migration_degraded` `transaction_failed` + error | Falló la transacción de migración de `clientId` en IndexedDB (post-open). |
| `[offline-db] migration_degraded` `idb_blocked_pending_upgrade` + `{ currentVersion, blockedVersion }` | Otra pestaña bloqueó `upgradeneeded`; cerrar otras pestañas o recargar. |
| `[offline-db] migration_row_failed` + `localId` + error | Error al migrar una fila concreta en IDB (se sigue con el resto). |
| `[offline-db] idb_blocked` (warn) + texto + versión | Aviso antes del estado degradado por bloqueo de versión de IDB. |

## Reglas IDB (recordatorio)

1. Solo **añadir** campos en upgrades; nunca quitar ni renombrar una vez en producción.
2. Migración **idempotente**: fila ya con `clientId` no se sobreescribe.
3. Probar con datos densos (p. ej. muchas filas / estados mixtos) — ver tests de migración.

## Safari / lifecycle

- Preferir **`pagehide`** frente a `beforeunload` en iOS.
- Registrar **`pagehide` y `visibilitychange`**; el flush debe ser **idempotente**.

## Debounce

- Rango sugerido **300–500 ms** para texto del wizard.
- Estrategia elegida: **coalescer** (timer reiniciado + merge al último estado), documentado en el hook. `flush()` expuesto para tests y guardados inmediatos.
