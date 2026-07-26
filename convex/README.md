# Convex — Smartcheck PWA

## Origen del modelo

El esquema (`schema.ts`) sigue el catálogo de secciones e ítems del informe Smartcheck. Cada tabla de sección está vinculada a `inspections` por `inspectionId`.

## Comandos

```bash
# Desarrollo (watch + push + codegen)
pnpm convex:dev
# o
npx convex dev
```

Una sola pasada (útil en CI o sin watch):

```bash
pnpm convex:once
```

## Variables de entorno

Tras `npx convex dev`, Convex añade/actualiza en `.env.local` (entre otras):

- `CONVEX_DEPLOYMENT` — deployment de desarrollo
- `NEXT_PUBLIC_CONVEX_URL` — URL del backend

**Clerk + Convex (Dashboard de Convex y/o `.env.local`):**

- `CLERK_JWT_ISSUER_DOMAIN` — Frontend API URL de Clerk (validación de JWT; ver `auth.config.ts`)
- `CLERK_WEBHOOK_SECRET` — Signing secret del webhook de Clerk (endpoint HTTP)

**Automatización / n8n (solo Dashboard de Convex → Settings → Environment Variables):**

- `N8N_WEBHOOK_URL` — URL del webhook n8n (POST JSON). Si está vacío, no se envía nada.
- `N8N_WEBHOOK_DISABLED` — Opcional: `true` para desactivar todos los envíos sin quitar código.

Las mutaciones relevantes encolan un `internalAction` asíncrono (no bloquean la UI). El cuerpo incluye `event`, `inspectionId`, `inspection` (documento actual de Convex) y `meta`.

**JWT template en Clerk (obligatorio para `ConvexProviderWithClerk`):**

1. Clerk Dashboard → **Configure** → **JWT Templates** → **New template**.
2. Nombre exacto: **`convex`** (todo minúsculas, sin espacios).
3. Guardar con los valores por defecto (Convex usa `applicationID: "convex"` en `auth.config.ts`).

Sin esto suele fallar: `POST .../tokens/convex` **404**.

**Issuer JWT y Convex:** en el **Dashboard de Convex** (deployment dev/prod), `CLERK_JWT_ISSUER_DOMAIN` debe ser **exactamente** el **Frontend API URL** de la **misma** app de Clerk que usan tus keys en `.env.local`. Si cambias de instancia Clerk, actualiza Convex y ejecuta `pnpm convex:dev`. Guía: [`docs/CLERK_CONVEX_AUTH.md`](../docs/CLERK_CONVEX_AUTH.md).

**Next.js 16:** `proxy.ts` en la raíz con `clerkMiddleware()`; `next.config.ts` fija `turbopack.root` para que Next no use un directorio padre por error (y Clerk detecte el middleware).

## Usuarios y roles (Módulo 0.4)

- Tabla `users` sincronizada con Clerk vía webhook HTTP (`/clerk-webhook`).
- **Primer usuario** en la BD → `admin`; el resto → `tecnico`.
- Helpers en `convex/lib/auth.ts`: `getCurrentUser`, `requireAuth`, `requireUser`, `requireAdmin`, `canAccessInspection`, `canAccessInspectionByClientId`, `inspectionByClientId`, `canExportPdf`.
- `users.promoteToAdmin` — solo admin.
- `users.exportPdfAllowed` — `true` para admin o técnico aprobado (UI de generar/exportar PDF).

URL del webhook en Clerk:

`https://<deployment>.convex.site/clerk-webhook`

Eventos: `user.created`, `user.updated`, `user.deleted`.

## Tablas

| Tabla | Descripción |
|-------|-------------|
| `users` | `clerkId`, `email`, `name`, `imageUrl`, `role` (`tecnico` \| `admin`), timestamps |
| `inspections` | Información general (cliente, vehículo, tarifas, fotos storage); **`clientId`** opcional (UUID estable para URL local-first; índice `by_client_id`) |
| `section_motor` … `section_finalizacion` | 18 secciones; cada ítem es `{ value, observation? }` según tipo (br, brNa, sn, snNa) |

Los valores de select/listas del catálogo se modelan como literales en inglés/snake_case (ej. `captureSource`: `publicidad`, `tiktok`, …).

## Fotos

- `inspections.vehiclePhoto`, `circulationCard`: `Id<'_storage'>`
- Cada sección: campo opcional `photos: Id<'_storage'>[]` (fotos a nivel de sección)

## Funciones

- `inspections.createDraft` — borrador; usuario actual (JWT Clerk)
- **`inspections.createOrUpdateFromDraft`** — mutación idempotente por **`clientId`**: si ya existe fila con ese `clientId` y el caller tiene acceso, hace **patch**; si no, **inserta** borrador con `clerkUserId` del usuario. Sin **`photoManifest`** hasta Fase 5. Antes de patchear comprueba **`canAccessInspectionByClientId`**. Notificaciones n8n (si no están desactivadas) se encolan con **`ctx.scheduler.runAfter(0, internal.n8nWebhook.deliver, …)`** para no bloquear la mutación.
- **`inspections.getByClientId`** — query por `clientId`; devuelve el documento solo si **`canAccessInspectionByClientId`** (misma regla de propiedad que `get` por `_id`). Si no hay sesión, no hay acceso o no existe fila → `null`.
- `inspections.patch` / `get` — con control de acceso (técnico: propias; admin: todas)
- `inspections.listByClerkUser` — técnico: propias; admin: todas
- `users.getMe`, `users.list` (admin), `users.promoteToAdmin`, `users.exportPdfAllowed`

## Migraciones de datos — convención (`convex/migrations.ts`)

- **Por defecto:** migraciones masivas o operadas por ops se implementan como **`internalMutation`** / **`internalQuery`** (nombre explícito, p. ej. sufijo `Internal`). Se ejecutan con **`npx convex run --prod migrations:nombreInternal '{}'`** (o sin `--prod` en dev). No requieren JWT de Clerk; el Dashboard de Convex **no** envía sesión de Clerk a las funciones públicas.
- **Excepción:** si la misma lógica debe invocarse **desde la app** con admin autenticado, se añade una **`mutation`/`query` pública** con `requireAdmin` que **delega** en el **mismo helper** que la variante internal. Así el batching / paginación / manejo de errores vive en **un solo sitio**; las dos rutas heredan el mismo arreglo si aparece un bug.
- **Lección:** el patrón heredado de solo `mutation` + `requireAdmin` (como `migrateLegacyCountryOfOrigin`) **no sirve** para Functions del Dashboard ni para CLI sin `--identity`. Las migraciones **nuevas** deberían seguir el patrón internal-first de arriba; las legacy se pueden dejar como están hasta que alguien las toque.

**Backfill** de `clientId` en inspecciones legacy:

**Auth:** las funciones **públicas** `countInspectionsMissingClientId` y `backfillInspectionClientIds` usan **`requireAdmin`** → hace falta **JWT de Clerk** (sesión admin en la app). El **Dashboard de Convex → Functions** al ejecutar una función pública **no** envía ese token: obtendrás `No autenticado`. Para operar **sin** sesión Clerk usá las variantes **internal** desde la terminal (mismo cuerpo, sin auth):

```bash
# Conteo (prod: añadí --prod si corresponde)
npx convex run migrations:countInspectionsMissingClientIdInternal '{}'

# Una tanda de backfill (repetir con cursor hasta done: true)
npx convex run migrations:backfillInspectionClientIdsInternal '{}'
```

Las funciones son **internal** en el código (no accesibles desde `ConvexReactClient` en el browser), pero el CLI las referencia como `migrations:nombreInternal`.

**Volumen en producción:** este repo no tiene visibilidad del conteo real. En **Convex Dashboard → Data → `inspections`** revisá cuántas filas hay y cuántas carecen de `clientId`, o usá `migrations:countInspectionsMissingClientIdInternal` desde CLI (arriba). Si son **miles** o más, asumí límites de mutación (~1s) y usá tandas; si son **cientos**, pocas invocaciones bastan.

1. **Snapshot previo:** `migrations:countInspectionsMissingClientIdInternal` (o la query pública **solo** con sesión admin en la app) y anotar el número.
2. **Tandas:** `migrations:backfillInspectionClientIdsInternal` (o la mutación pública con admin en la app). Argumentos opcionales: `batchSize` (1–1000, **defecto 500**), `cursor` (`null` u omitido en la primera tanda; luego el `nextCursor` devuelto). Repetir hasta **`done === true`**. En cada respuesta: `scanned` = documentos leídos en esa tanda; `patched` / `skipped` solo en esa tanda; **`errors`** lista `{ id, reason }` por fila cuyo `patch` falló (el resto de la tanda sigue).
3. **Verificación opcional durante:** sumá `patched` de todas las tandas; si coincide con el snapshot previo (salvo inserciones concurrentes), mejor.
4. **Snapshot final:** conteo **0** (misma función de conteo que en el paso 1).

Tests: `tests/convex/migrations.test.ts`.

## Tests (`convex-test`)

Tras `pnpm install` (incluye `convex-test`, `@edge-runtime/vm`, `vitest`):

```bash
pnpm test
```

`tests/convex/inspections.test.ts` comprueba idempotencia: dos llamadas con el mismo `clientId` → la segunda **patchea** (`created: false`) y no crea otra fila. `tests/convex/migrations.test.ts` cubre el backfill admin de `clientId` en Convex. Los tests de Convex usan `environment: edge-runtime` (ver `vitest.config.mjs`). Con **`N8N_WEBHOOK_DISABLED=true`** (fijado en config de Vitest para esos archivos) no se encola n8n. Los módulos Convex se cargan vía `import.meta.glob` sobre `convex/**/*.ts` excluyendo solo `*.test.ts` (Vite no admite `ignore` en glob; hay que filtrar a mano).

Las mutaciones por sección se pueden añadir en `sections.ts` o archivos por dominio.

## BI (Business Intelligence) — `convex/bi/` + tablas `finance_entries`, `inspections_legacy`, `bi_*`

> ⚠️ **NO ELIMINAR estas tablas ni la carpeta `convex/bi/`.** Convex despliega **toda** la
> carpeta `convex/`: un `deploy` de `main` que **no** incluya `convex/bi/` **borra esas funciones
> de producción** y rompe el dashboard BI (los datos de las tablas persisten, pero las queries/mutations
> desaparecen). Igual, quitar una tabla del `schema.ts` la marca *"missing from schema"* y rompe las
> funciones que la referencian. Si vas a refactorizar el schema o limpiar funciones, **deja intacto todo
> lo marcado como BI** salvo que coordines con el proyecto BI.

**Qué es esto.** SmartCheck tiene un dashboard de BI (app Next.js aparte, **dominio propio**, solo para
Esteban) que **comparte este mismo backend de Convex**. Por eso conviven aquí lo operativo (PWA de
inspecciones) y lo analítico (BI). Todo lo BI es **aditivo** y **solo lectura** sobre lo operativo:
no modifica `inspections` ni las secciones.

- **Modelo canónico y decisiones:** `SmartCheck-BI-Proyecto/docs/MODELO-DATOS.md` (fuera de este repo).
- **Tablas nuevas** (prefijo/marca propia, ver comentarios en `schema.ts`):
  | Tabla | Rol |
  |-------|-----|
  | `finance_entries` | Ledger único ingresos/gastos/viáticos (histórico del Sheet + captura manual futura). Cifra normalizada en **₡** (`amountCRC`). Idempotencia por `externalKey`. Soft-delete (`isDeleted`), **nunca hard-delete**. |
  | `inspections_legacy` | Inspecciones históricas del CRM (Google Sheet, **frozen**). Import único. Idempotencia por `sourceRowId`. La PWA es el registro oficial de **este mes en adelante**; legacy cubre lo anterior. |
  | `bi_quality_issues` | Log de calidad (outliers, ambigüedades, errores de carga). Regla: **nunca filtrar en silencio** — se marca aquí. |
  | `bi_meta` | Frescura/estado por proceso (última corrida, ok/error). |

- **Funciones (`convex/bi/`):** todas `internalMutation` / `internalQuery` — **no** accesibles desde el
  cliente (`ConvexReactClient`), solo por CLI (`npx convex run bi/…`) o desde otras funciones internal.
  - `bi/finance.ts` — `loadFinanceBatch` (upsert idempotente), `financeMonthlyTotals`, `setFinanceMeta`, `resetFinanceIssues`.
  - `bi/legacy.ts` — `loadLegacyBatch`, `applyLegacyCorrections`, `legacyStats`, `loadLegacyIssues`, `setLegacyMeta`, `resetLegacyIssues`.
  - `bi/lib/dates.ts` — helpers de fecha/period en zona `America/Costa_Rica`.

- **Mutations de migración = un solo uso, idempotentes.** Cargan el histórico (Sheet financiero + CRM)
  y aplican correcciones puntuales de Esteban. Re-correrlas **no duplica** (upsert por llave estable).
  Se quedan en el repo como registro reproducible/auditable de la migración; son inofensivas (internal).

- **Backups locales:** `/.convex-snapshots/` (gitignored) — zips de export dev/prod. **No versionar.**
