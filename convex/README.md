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
- Helpers en `lib/auth.ts`: `getCurrentUser`, `requireAuth`, `requireUser`, `requireAdmin`, `canAccessInspection`, `canExportPdf`.
- `users.promoteToAdmin` — solo admin.
- `users.exportPdfAllowed` — `true` solo para admin (UI de exportar PDF).

URL del webhook en Clerk:

`https://<deployment>.convex.site/clerk-webhook`

Eventos: `user.created`, `user.updated`, `user.deleted`.

## Tablas

| Tabla | Descripción |
|-------|-------------|
| `users` | `clerkId`, `email`, `name`, `imageUrl`, `role` (`tecnico` \| `admin`), timestamps |
| `inspections` | Información general (cliente, vehículo, tarifas, fotos storage) |
| `section_motor` … `section_finalizacion` | 18 secciones; cada ítem es `{ value, observation? }` según tipo (br, brNa, sn, snNa) |

Los valores de select/listas del catálogo se modelan como literales en inglés/snake_case (ej. `captureSource`: `publicidad`, `tiktok`, …).

## Fotos

- `inspections.vehiclePhoto`, `circulationCard`: `Id<'_storage'>`
- Cada sección: campo opcional `photos: Id<'_storage'>[]` (fotos a nivel de sección)

## Funciones

- `inspections.createDraft` — borrador; usuario actual (JWT Clerk)
- `inspections.patch` / `get` — con control de acceso (técnico: propias; admin: todas)
- `inspections.listByClerkUser` — técnico: propias; admin: todas
- `users.getMe`, `users.list` (admin), `users.promoteToAdmin`, `users.exportPdfAllowed`

Las mutaciones por sección se pueden añadir en `sections.ts` o archivos por dominio.
