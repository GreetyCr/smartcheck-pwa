# PR-C / Fase 2 — Operativo (borrador local IndexedDB)

Este documento resume el alcance **PR-C** y las reglas que el team lead dejó para evitar sorpresas en producción. **No sustituye** `docs/MIGRACION_LOCAL_FIRST_CHECKLIST.md`.

## Alcance PR-C (infra aislada)

- `lib/offline/db.ts`: versión **2**, migración **aditiva** e **idempotente** (`clientId` solo si falta; nunca pisar `clientId` existente). Callback **`blocked`** en `openDB` con `console.warn` + `console.error` bajo `[offline-db] migration_degraded`. Logs de fallo: `[offline-db] migration_degraded`, `[offline-db] migration_row_failed`.
- `lib/offline/db.testing.ts`: **`resetOfflineDbForTests`** solo para Vitest (no importar desde app; no entra en bundle de producción).
- `lib/offline/shouldFlushOnPageHide.ts`: política **bfcache** (`persisted`) compartida con el hook y tests puros en Node.
- `lib/types/clientId.ts`: tipo **branded** `ClientId`.
- `hooks/usePendingInspectionDraft.ts`: debounce con **coalescer** (un solo `put` con último estado), `flush()`, `pagehide` vía `shouldFlushOnPageHide` (`persisted === false`) y `visibilitychange` (`hidden`); **flush en cleanup** del efecto de carga (SPA sin `pagehide`). En lifecycle **sin** `await` del `put`.
- Tests: `lib/offline/__tests__/…`, `lib/offline/__tests__/shouldFlushOnPageHide.test.ts`, `hooks/__tests__/usePendingInspectionDraft.test.tsx` (`fake-indexeddb`, `happy-dom`).

## Qué NO tocar en este PR

- `VehicleForm.tsx`, `ClientForm.tsx`, `InspectionWizard.tsx` / layout wizard (Fase 3 + flag).
- `SyncContext.tsx`, `lib/offline/sync.ts`.
- `useOfflineInspection` (convive hasta limpieza final).
- **Cero UI nueva** ni cambios visibles: si QA ve comportamiento distinto tras merge, es **bug**.

## Comunicación a QA

**PR-C no introduce cambio de comportamiento observable** hasta que un padre use `usePendingInspectionDraft`. El hook puede mergearse sin esperar al backfill Convex de `clientId`; `clientId` en Convex sigue `v.optional()`.

## Riesgo y degradación

Si la migración IDB falla en un navegador raro: se registra error, `getOfflineDbMigrationDegraded()` pasa a `true` y el hook entra en **solo lectura** (no bloquear el wizard entero).

## Pendiente (fuera de PR-C)

- **Backfill Convex `clientId`** (`convex/migrations.ts`, PR pequeño): conviene **antes de Fase 3** para no mezclar filas con/sin `clientId` cuando el cliente empiece a usar `getByClientId`. Mutación interna que itera inspecciones sin `clientId` y asigna UUID; verificable en el Dashboard.

1. Solo **añadir** campos en upgrades; nunca quitar ni renombrar una vez en producción.
2. Migración **idempotente**: fila ya con `clientId` no se sobreescribe.
3. Probar con datos densos (p. ej. muchas filas / estados mixtos) — ver tests de migración.

## Safari / lifecycle

- Preferir **`pagehide`** frente a `beforeunload` en iOS.
- Registrar **`pagehide` y `visibilitychange`**; el flush debe ser **idempotente**.

## Debounce

- Rango sugerido **300–500 ms** para texto del wizard.
- Estrategia elegida: **coalescer** (timer reiniciado + merge al último estado), documentado en el hook. `flush()` expuesto para tests y guardados inmediatos.
