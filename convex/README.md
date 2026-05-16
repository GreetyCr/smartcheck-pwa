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
- `users.exportPdfAllowed` — `true` solo para admin (UI de exportar PDF).

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

**Backfill** de `clientId` en inspecciones legacy (`convex/migrations.ts`):

**Auth:** las funciones **públicas** `countInspectionsMissingClientId` y `backfillInspectionClientIds` usan **`requireAdmin`** → hace falta **JWT de Clerk** (sesión admin en la app). El **Dashboard de Convex → Functions** al ejecutar una función pública **no** envía ese token: obtendrás `No autenticado`. Para operar **sin** sesión Clerk usá las variantes **internal** desde la terminal (mismo cuerpo, sin auth):

```bash
# Conteo (prod: añadí --prod si corresponde)
npx convex run migrations:countInspectionsMissingClientIdInternal '{}'

# Una tanda de backfill (repetir con cursor hasta done: true)
npx convex run migrations:backfillInspectionClientIdsInternal '{}'
```

Las funciones son **internal** en el código (no accesibles desde `ConvexReactClient` en el browser), pero el CLI las referencia como `migrations:nombreInternal`.

**Volumen en producción:** este repo no tiene visibilidad del conteo real. En **Convex Dashboard → Data → `inspections`** revisá cuántas filas hay y cuántas carecen de `clientId`, o usá el `internal:…count…` de arriba. Si son **miles** o más, asumí límites de mutación (~1s) y usá tandas; si son **cientos**, pocas invocaciones bastan.

1. **Snapshot previo:** `internal:…countInspectionsMissingClientIdInternal` (o la query pública **solo** con sesión admin en la app) y anotar el número.
2. **Tandas:** `internal:…backfillInspectionClientIdsInternal` (o la mutación pública con admin en la app). Argumentos opcionales: `batchSize` (1–1000, **defecto 500**), `cursor` (`null` u omitido en la primera tanda; luego el `nextCursor` devuelto). Repetir hasta **`done === true`**. En cada respuesta: `scanned` = documentos leídos en esa tanda; `patched` / `skipped` solo en esa tanda; **`errors`** lista `{ id, reason }` por fila cuyo `patch` falló (el resto de la tanda sigue).
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
