# Checklist archivo por archivo — Local-first «Iniciar inspección»

Orden de fases acordado: **1 → 2 → 4 → 3 (flag) → 5 → 6 ∥ 7**.

Convenciones cerradas:

- **IDB**: un solo modelo; `PendingInspectionRow` evoluciona (versión DB **2**), sin `wizardDrafts` separado.
- **URL**: `/inspecciones/[clientId]` con `clientId` = UUID v4 estable; no cambia tras sync.
- **Legacy**: `useOfflineInspection` + `syncPendingToConvex` conviven detrás de **`useUnifiedDraftFlow`** hasta retirada en PR de limpieza.

---

## Decisiones cerradas pre-PR-E (check-in Fase 3)

1. **`resolveInspectionRef`** — Orden de resolución: **IDB → UUID v4 (`getByClientId`) → id Convex `inspections` (`get`) → `not_found`**. Si `ref` **parece UUID v4** y **no** hay fila en IDB, **igual** hay que intentar Convex (`getByClientId` + acceso): es el caso link en **otro dispositivo** (p. ej. WhatsApp) con IDB vacío; **no** devolver `not_found` solo por ausencia local. Clasificación por forma: **`lib/inspection/idValidation.ts`** — `isUuidV4` (RFC, un solo patrón explícito) y `looksLikeConvexInspectionId` (heurística de longitud/charset; reemplazable si Convex publica helper). En servidor, **`normalizeId("inspections", ref)`** sigue siendo la verificación de pertenencia a tabla. **Redirect canónico** cuando `kind === "convex"` y se conoce `clientId`: `router.replace` (no `push`) a `/inspecciones/{clientId}/…`, solo si hay **acceso confirmado** e **inspección existente**; si no hay acceso o el doc no existe → **`not_found`** directo (sin redirect a URL muerta).

2. **`InspectionCabeceraScreen` (pre-sync)** — **Solo lectura** + hint visible (copy base: «Se podrá editar cuando el informe esté sincronizado») + CTA opcional «Sincronizar ahora». El CTA debe invocar el **mismo** `processSyncQueue` que el lifecycle automático (una sola fuente de verdad).

3. **`SectionForm` (modo local)** — Catálogo de ítems ya es **estático en bundle** (`lib/constants/sectionItems.ts`). Estado por sección en IDB: forma **alineada** a lo que devuelve `sections.getSection`, menos campos server-only. Preferible **`toUpsertPayload(localSectionRow): UpsertSectionArgs`** único (sin lógica por sección). **`upsertSection` solo** cuando exista **`convexId`** del padre; hasta entonces solo IDB. La cola debe **crear/actualizar primero la inspección** (`createOrUpdateFromDraft`) y **después** las secciones de esa inspección. Fotos: **misma cola** que Fase 5 / cabecera (sin canal paralelo).

4. **`useUnifiedDraftFlow`** — Implementado en **`lib/featureFlags.ts`**: boolean por entorno (`NEXT_PUBLIC_USE_UNIFIED_DRAFT_FLOW`, lectura con `trim` + `toLowerCase`). Regla de cola documentada **en comentario junto a la función** (entrada bajo flag; **sync siempre drena**). En cliente: **`console.info("[smartcheck] useUnifiedDraftFlow:", …)`** y **`window.__smartcheck.useUnifiedDraftFlow`** al cargar el bundle (QA / soporte). Granularidad por usuario → segunda iteración si hace falta.

---

## Fase 3 — PR-E (greenlight y plan de PRs)

**Insumos listos:** decisiones en este doc; **`lib/featureFlags.ts`** (regla cola comentada); **`lib/inspection/idValidation.ts`** + tests; **backfill `clientId` en prod** (count final 0).

### Partir en PR-E1 + PR-E2 (recomendado)

| PR | Alcance | Objetivo |
|----|---------|----------|
| **PR-E1** | Solo módulos puros: `lib/inspection/resolveInspectionRef.ts` (orden IDB → UUID v4 → Convex id legacy → `not_found`, usando `idValidation.ts`); `hooks/useUnifiedInspection.ts` (consume resolver, expone `kind`, `clientId?`, `convexId?`, `syncStatus`, …); **tests** con fixtures (p. ej. fake-indexeddb + mocks Convex). **Sin** tocar rutas ni componentes de pantalla. | Review chica; decisiones del resolver aisladas del ruido de UI. |
| **PR-E2** | Tras merge de E1: `app/(dashboard)/inspecciones/[id]/page.tsx`, `[id]/cabecera/page.tsx`, `[id]/seccion/[seccionId]/page.tsx`, `nueva/layout.tsx`; `VehicleForm`, `InspectionSectionsScreen`, `InspectionCabeceraScreen`; `clientId` al entrar al wizard; cableado bajo **`useUnifiedDraftFlow`**; smoke manual **documentado en el cuerpo del PR**. | Review centrada en integración y routing. |

**Un solo PR-E** es defendible si el smoke manual es exhaustivo; el equipo puede elegir velocidad vs tractabilidad.

### Obligatorio en tests de PR-E1

**UUID con forma v4 y sin fila en IDB** → el resolver **debe** seguir a Convex (`getByClientId` / acceso) y **no** devolver `not_found` solo por no estar en IDB (otro dispositivo / IDB limpio).

### Smoke antes de aprobar merge de PR-E2

1. **Flag OFF** en `.env.local`: wizard **igual que hoy** — crear inspección y verificar persistencia en Convex por el flujo actual.
2. **Flag ON:** tap «Iniciar inspección» usable sin red; completar wizard **offline**; al restaurar red, la inspección aparece en Convex **sin** pasos extra del usuario.
3. **Flag ON**, URL legacy `/inspecciones/{idConvex}` (document `_id` de Convex): debe resolver y, según decisión cerrada, **`router.replace`** a `/inspecciones/{clientId}`.

---

## Refinamientos baseline (previos a Fase 1 — incorporados)

1. **`lib/offline/syncQueue.ts` tipado**: el adaptador que llama a Convex **no** usa `unknown`. Tras existir la mutación, usar por ejemplo `import type { FunctionArgs } from "convex/server";` y `export type CreateOrUpdateFromDraftArgs = FunctionArgs<typeof api.inspections.createOrUpdateFromDraft>` (o el helper que exporte el proyecto) para que un cambio de contrato rompa compilación en la cola.

2. **`photoManifest` con `slot`**: cada ítem incluye `{ clientPhotoId, storageId, slot }` donde `slot` es un literal de cabecera, p. ej. `"vehicleFront" | "vehicleSideLeft" | "vehicleSideRight" | "vehicleRear" | "dekra" | "plate" | "marchamo" | "vinSticker"` (alinear nombres con campos `patch` / storage). Sin `slot`, la mutación no puede mapear fotos sin un patch posterior (estados intermedios frágiles).

3. **Validador compartido obligatorio (Fase 4)**: `lib/validation/inspectionDraft.ts` (Zod) + `convex/lib/validateInspectionDraft.ts` que reutiliza o importa el mismo esquema. **Bloqueante** en Fase 4: servidor debe rechazar payloads viejos tras deploy. Recomendación: test en CI que compare salida/keys de ambos esquemas para evitar deriva.

4. **Política de purga**: módulo **`lib/offline/retention.ts`** (Fase 7): al boot, en filas `syncStatus === "synced"`, si `syncedAt < now - 7d` → quitar `wizard` y blobs; conservar metadatos ligeros hasta `now - 30d` luego purgar fila según política. Constantes editables y texto operativo en **`docs/MIGRACION_LOCAL_FIRST_OPERACION.md`**.

5. **`resolveInspectionRef` y `not_found`**: contrato de UI en pantalla detalle: si `kind === "not_found"`, render fijo «Inspección no encontrada» con CTA a `/inspecciones/nueva` — evita spinner infinito con enlaces inválidos.

6. **Fuente de verdad de sync**: documentado en **`hooks/useSyncQueue.ts`** (comentario de módulo) y en operación: IDB autoritativa mientras `syncStatus !== "synced"`; tras `synced`, Convex manda. UI Fase 6 no mezcla ambas en el mismo indicador.

7. **`PhotoCapture`**: sin prop de compresión; permanece «dumb». La compresión vive en el padre que conoce el flujo (**`VehicleForm`** para wizard; otros padres según pantalla).

8. **HEIC / formatos**: política práctica — intentar `createImageBitmap(file)`; si falla, UX clara (mensaje usuario); sin librerías HEIC extra. Implementado en **`lib/images/compressVehiclePhoto.ts`**.

9. **IndexedDB `keyPath`**: mantener **`keyPath: "localId"`** sin migración destructiva; invariante **`localId === clientId`** en código. Comentario junto al store + aserción en **`lib/offline/__tests__/db-migration-v2.test.ts`**. Renombrar `keyPath` solo en PR final de limpieza.

10. **Índice único lógico en Convex**: no hay `unique` declarativo; patrón **`withIndex("by_client_id").unique()`** + insert o patch en **una sola mutación**; concurrencia optimista de Convex. Dejar **comentario breve en `convex/inspections.ts`** junto a `createOrUpdateFromDraft` para evitar «doble lectura defensiva» que reintroduzca condiciones de carrera.

11. **Webhook n8n**: si `inspection_created` (u otro) se dispara desde `createOrUpdateFromDraft`, usar **`ctx.scheduler.runAfter(0, internal.n8nWebhook.deliver, …)`** para no romper atomicidad de la mutación. Ver también `docs/MIGRACION_LOCAL_FIRST_OPERACION.md`.

12. **`docs/FLUJO_CREACION_INFORME.html`**: actualización en Fase 7 con criterio de alto nivel (modelo local-first, `clientId`, cola); **omitir** detalle interno de cabecera.

13. **`convex/lib/auth.ts`**: **`canAccessInspectionByClientId`** es **obligatorio** en `getByClientId` (y cualquier query por `clientId`) — misma regla de propiedad que `get` actual; evita fuga por UUID adivinado.

---

## 1. Archivos nuevos (crear)

| Archivo | Fase | Rol |
|---------|------|-----|
| `lib/images/compressVehiclePhoto.ts` | **1 (hecho)** | JPEG calidad **0.82** (`VEHICLE_PHOTO_JPEG_QUALITY`), lado mayor **1600**; `createImageBitmap` + canvas; `ImageBitmap` cerrado en `finally` (`closeBitmapSafe`); `File` con `type: image/jpeg` y nombre `.jpg`; carrera en **`VehicleForm`** con generación por slot. |
| `lib/featureFlags.ts` | **3 (hecho)** | `useUnifiedDraftFlow()` + env normalizado + log `[smartcheck]` + `window.__smartcheck`; import side-effect en `ConvexClientProvider.tsx`. |
| `lib/inspection/idValidation.ts` | **3 (hecho)** | `isUuidV4`, `looksLikeConvexInspectionId`; tests `lib/inspection/idValidation.test.ts`. |
| `lib/validation/inspectionDraft.ts` | **4 (oblig.)** | Esquema Zod compartido (wizard + payload mutación). |
| `convex/lib/validateInspectionDraft.ts` | **4 (oblig.)** | Validación servidor; importa o duplica controlada vs `lib/validation`. |
| `lib/inspection/resolveInspectionRef.ts` | **PR-E1** | § Fase 3 — PR-E; `idValidation`; orden IDB → UUID → legacy `get`. |
| `hooks/usePendingInspectionDraft.ts` | 2 | Debounce + `pagehide` / `beforeunload`. |
| `hooks/useUnifiedInspection.ts` | **PR-E1** | § Fase 3 — PR-E; consume resolver; UI bajo flag en PR-E2. |
| `lib/offline/syncQueue.ts` | 5 | Cola; adapters tipados con `FunctionArgs<typeof api.inspections.createOrUpdateFromDraft>`. |
| `lib/offline/retention.ts` | 7 | Purga 7d / retención metadatos 30d; ver `MIGRACION_LOCAL_FIRST_OPERACION.md`. |
| `docs/MIGRACION_LOCAL_FIRST_OPERACION.md` | **7 (creado)** | Retención, fuente de verdad sync, n8n, criterio doc HTML. |

~~`lib/images/photoMeta.ts`~~ — no hace falta para Fase 1 si el draft sigue usando `File` comprimido.

### Firmas sugeridas (TypeScript)

#### `lib/images/compressVehiclePhoto.ts` (implementado)

Exporta `VEHICLE_PHOTO_MAX_EDGE`, `VEHICLE_PHOTO_JPEG_QUALITY` (0.82), `VEHICLE_PHOTO_OUTPUT_MIME`, `computeScaledDimensions` (tests puros), `compressVehiclePhoto`.

```ts
export async function compressVehiclePhoto(file: File, options?: { maxEdge?: number; quality?: number }): Promise<CompressedVehiclePhoto>;
```

Tests: `lib/images/compressVehiclePhoto.test.ts` (`pnpm test`, Vitest `environment: node` + mocks mínimos de `document` / `createImageBitmap`).

#### `lib/inspection/resolveInspectionRef.ts` (cliente)

```ts
export type ResolvedInspection =
  | { kind: "local_only"; row: PendingInspectionRow }
  | { kind: "convex"; clientId: string; convexId: Id<"inspections"> }
  | { kind: "not_found" };

export async function resolveInspectionRef(ref: string): Promise<ResolvedInspection>;
```

Orden: **IDB → UUID v4 → id Convex** (ver «Decisiones cerradas pre-PR-E»). Clasificación: **`lib/inspection/idValidation.ts`**. **UI**: `not_found` → pantalla fija + CTA a `/inspecciones/nueva`. **`kind === "convex"`** con `clientId` conocido → redirect canónico con **`router.replace`** (condiciones de acceso y existencia cumplidas).

#### `lib/offline/syncQueue.ts` (Fase 5)

```ts
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";

export type CreateOrUpdateFromDraftArgs = FunctionArgs<
  typeof api.inspections.createOrUpdateFromDraft
>;

export async function processSyncQueue(adapters: {
  generateUploadUrl: () => Promise<string>;
  createOrUpdateFromDraft: (
    args: CreateOrUpdateFromDraftArgs,
  ) => Promise<{ inspectionId: string }>;
}): Promise<{ processed: number; errors: number }>;
```

(Ajustar import de `FunctionArgs` a la ruta válida del stack Convex del repo cuando se cablee.)

#### `createOrUpdateFromDraft` — `photoManifest` con `slot`

```ts
photoManifest: v.optional(
  v.array(
    v.object({
      clientPhotoId: v.string(),
      storageId: v.id("_storage"),
      slot: v.union(
        v.literal("vehicleFront"),
        v.literal("vehicleSideLeft"),
        v.literal("vehicleSideRight"),
        v.literal("vehicleRear"),
        v.literal("dekra"),
        v.literal("plate"),
        v.literal("marchamo"),
        v.literal("vinSticker"),
      ),
    }),
  ),
),
```

---

## 2. Convex — modificar / crear

| Archivo | Acción | Contenido |
|---------|--------|-------------|
| `convex/schema.ts` | **PR-B** | `clientId` opcional + índice `by_client_id`. |
| `convex/inspections.ts` | **PR-B** | `getByClientId`, `createOrUpdateFromDraft` (sin `photoManifest`); comentario concurrencia. |
| `convex/lib/auth.ts` | **PR-B** | `inspectionByClientId`, `canAccessInspectionByClientId`. |
| `tests/convex/inspections.test.ts` | **PR-B** | `convex-test` + `edge-runtime`; glob `../../convex/**/*.ts` (tests fuera de `convex/` para no romper `convex codegen`). |
| `convex/migrations.ts` | Modificar | Backfill `clientId`. |
| `convex/n8nWebhook.ts` | Modificar si aplica | Payload con `clientId`. |
| `convex/README.md` | Modificar | Nuevas APIs y reglas de acceso. |

Las mutaciones **`sections.*`**, **`pdfs.*`**, **`usePhotoUpload`** siguen recibiendo **`Id<"inspections">`** tras resolver una vez en el boundary.

---

## 3. IndexedDB — `lib/offline/db.ts`

| Acción | Detalle |
|--------|---------|
| Modificar | `DB_VERSION` **1 → 2**; migración no destructiva; **`localId === clientId`** invariante documentada en comentario junto al `createObjectStore`. |
| Modificar tipo | `PendingInspectionRow`: `clientId`, `wizard?`, nuevos `syncStatus`, etc. |
| Tests | `lib/offline/__tests__/db-migration-v2.test.ts`, `db-invariants.test.ts`, `hooks/__tests__/usePendingInspectionDraft.test.tsx` (fake-indexeddb + happy-dom). Ver `docs/PR_C_FASE2_OPERATIVO.md`. |

---

## 4. Sincronización — `lib/offline/sync.ts`, `contexts/SyncContext.tsx`

| Archivo | Acción |
|---------|--------|
| `lib/offline/sync.ts` | Evolucionar / delegar en `syncQueue` bajo flag. |
| `contexts/SyncContext.tsx` | `visibilitychange`, cola unificada cuando flag activo. |

---

## 5. App Router — `app/(dashboard)/inspecciones/`

| Archivo | Acción |
|---------|--------|
| `[id]/page.tsx` | `resolveInspectionRef`; `not_found` + CTA; redirect canónico `replace` cuando aplique. |
| `[id]/cabecera/page.tsx` | Misma resolución; cabecera solo lectura + hint + CTA sync → `processSyncQueue` compartido. |
| `[id]/seccion/[seccionId]/page.tsx` | Pasar refs resueltos; `SectionForm` local vs Convex según plan. |

---

## 6. Componentes e hooks — modificar

| Archivo | Fase | Notas |
|---------|------|--------|
| `components/inspection/VehicleForm.tsx` | **1 (hecho)** | Compresión en `onVehiclePhotoPicked` antes de `setDraft`; `PhotoCapture` sin cambios. |
| `hooks/usePendingInspectionDraft.ts` | **PR-C** | Debounce coalescer, `pagehide` / `visibilitychange`, `flush()`; sin cablear wizard hasta Fase 3. |
| `components/inspection/ClientForm.tsx` | 2+ | `clientId` al entrar al wizard (integración con hook / IDB en PR posterior al PR-C si aplica). |
| `components/inspection/InspectionWizard.tsx` / `nueva/layout.tsx` | 2+ | Inicialización IDB (tras PR-C). |
| `components/ui/PhotoCapture.tsx` | — | **Sin** prop `compressOnPick`; permanece dumb. |
| `components/inspection/InspectionSectionsScreen.tsx` | 3, 6 | Resolver + UI `not_found` + estado sync. |
| `components/inspection/SectionForm.tsx` | 3 | Local vs Convex. |
| `hooks/useSyncQueue.ts` | 5–6 | **Comentario de fuente de verdad** IDB vs Convex (ver operación). |
| `docs/FLUJO_CREACION_INFORME.html` | 7 | Alto nivel según refinamiento 12. |

---

## 7. Tests

| Archivo | Fase | Notas |
|---------|------|--------|
| `lib/images/compressVehiclePhoto.test.ts` | 1 | Vitest `node` + mocks mínimos; `tsconfig` excluye `*.test.ts` del `tsc` de app. |
| `tests/convex/inspections.test.ts` | PR-B | `convex-test` + `edge-runtime`; Vitest project separado; no forma parte de PR-A. |
| `lib/offline/__tests__/db-migration-v2.test.ts` | PR-C | fake-indexeddb; 20 filas, idempotencia, no pisar `clientId` existente. |
| `lib/offline/__tests__/db-invariants.test.ts` | PR-C | `localId === clientId` tras crear / migrar. |
| `hooks/__tests__/usePendingInspectionDraft.test.tsx` | PR-C | debounce coalescer, `flush`, `pagehide` (happy-dom). |
| `lib/offline/__tests__/syncQueue.test.ts` | 7 | — |
| Test CI | 4+ | Esquema Zod cliente vs validación servidor (`inspectionDraft`). |

---

## 8. Borrar (PR final de limpieza)

| Elemento |
|------------|
| `useOfflineInspection` y rama antigua de `sync.ts` cuando `useUnifiedDraftFlow` sea único camino. |

---

## 9. URL `clientId` e historial legacy

Backfill Convex de `clientId` (**PR-D**). Resolución: clasificador explícito + `getByClientId` / `get` según tipo de ref; links legacy con `_id` siguen válidos; redirect canónico a URL por `clientId` cuando `kind === "convex"` (ver pre-PR-E).

---

## 10. Paralelización sin colisiones

| Trabajo | Archivos principalmente tocados |
|---------|-----------------------------------|
| **Fase 1** | `lib/images/compressVehiclePhoto.ts`, `VehicleForm.tsx` |
| **Fase 2 (PR-C)** | `lib/offline/db.ts`, `lib/types/clientId.ts`, `hooks/usePendingInspectionDraft.ts`, tests offline |
| **Fase 4** | `convex/schema.ts`, `convex/inspections.ts`, `convex/lib/auth.ts`, `lib/validation/`, `convex/lib/validateInspectionDraft.ts` |

**Fase 4 puede arrancar en paralelo con Fase 1** (sin solapamiento de archivos); el camino crítico baja.

Evitar dos PRs tocando **`VehicleForm.tsx`** y **`db.ts`** a la vez sin coordinar.

---

*Baseline aprobado con refinamientos 1–13. PR-A: `compressVehiclePhoto` + `VehicleForm` + `npm run test` + docs; smoke iOS en `MIGRACION_LOCAL_FIRST_OPERACION.md`.*
