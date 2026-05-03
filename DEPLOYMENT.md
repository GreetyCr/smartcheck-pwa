# Despliegue en producción (Vercel + Convex + Clerk)

Guía paso a paso para publicar **smartcheck-pwa** en **Vercel** con backend **Convex**, auth **Clerk** y subidas **UploadThing**.

---

## Prerrequisitos

- Cuenta en [Vercel](https://vercel.com), [Convex](https://dashboard.convex.dev), [Clerk](https://dashboard.clerk.com) y [UploadThing](https://uploadthing.com).
- **Node.js** 20+ y **pnpm** instalados localmente (`corepack enable` / `npm i -g pnpm`).
- Repositorio en GitHub/GitLab/Bitbucket conectado a Vercel (o CLI de Vercel).

### Clerk Production y dominio

Al crear la **instancia Production** en Clerk (“Create production instance”), el campo **Application domain** suele **no aceptar** `https://tu-proyecto.vercel.app`: hace falta un **dominio propio** (registro DNS que controles), p. ej. `https://app.tudominio.com`. Planifica comprar/configurar ese dominio **antes** de cerrar el flujo de Clerk Production. El subdominio `*.vercel.app` sigue siendo útil para previews y pruebas, pero **no sustituye** ese requisito para la instancia Production de Clerk según su asistente actual.

---

## 1. Convex (backend producción)

1. En la raíz del proyecto:  
   `pnpm install`  
   `npx convex login`
2. Crear o seleccionar un **deployment de producción**:  
   `npx convex deploy`  
   Confirma el proyecto cuando el CLI lo pida.
3. En **Convex Dashboard → Settings → Environment Variables** del deployment **prod**, configura al menos:
   - **`CLERK_JWT_ISSUER_DOMAIN`** — misma URL que **Frontend API / JWT issuer** de tu aplicación Clerk de **producción** (sin barra final).  
     Detalle: [`docs/CLERK_CONVEX_AUTH.md`](./docs/CLERK_CONVEX_AUTH.md).
   - **`CLERK_WEBHOOK_SECRET`** — signing secret del webhook de Clerk que apunte al endpoint HTTP de Convex (usuarios sincronizados).
4. Copia la **URL del deployment** (p. ej. `https://xxxx.convex.cloud`) para el siguiente paso como **`NEXT_PUBLIC_CONVEX_URL`**.

---

## 2. Clerk (autenticación)

1. Ten listo el **dominio de producción** que usará la app (ver nota arriba): Clerk Production suele pedir `https://…` de un dominio **propio**, no solo `*.vercel.app`.
2. En Clerk: **Create production instance** (p. ej. clone desde Development) y completa **Application domain** con ese dominio (cuando el DNS apunte a Vercel, el login quedará alineado).
3. En **API Keys** → pestaña **Production**, obtén:
   - **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`**
   - **`CLERK_SECRET_KEY`**
4. En **Domains / redirects** de Clerk, añade también las URLs que uses en la práctica (dominio custom **y**, si quieres, `https://tu-proyecto.vercel.app` para previews), según las opciones que ofrezca el dashboard.
5. Opcional (útil en desarrollo / página `/dev/jwt`): **`NEXT_PUBLIC_CLERK_ISSUER_URL`** = misma URL que `CLERK_JWT_ISSUER_DOMAIN` en Convex.
6. Si usas **JWT template “convex”** en Clerk para Convex, mantén **exactamente la misma app** de Clerk que las keys de Vercel y el mismo issuer en Convex (`docs/CLERK_CONVEX_AUTH.md`).

**Orden típico:** dominio registrado → instancia Clerk Production con ese dominio → DNS del dominio hacia Vercel → variables de Clerk en Vercel → deploy.

---

## 3. UploadThing (fotos del checklist)

1. Crea una app en UploadThing en modo producción.
2. Obtén **`UPLOADTHING_TOKEN`** (API key).
3. En el dashboard de UploadThing, configura la URL base de la API de tu app desplegada, p. ej.  
   `https://<tu-dominio-producción>/api/uploadthing`  
   (dominio custom en prod; en preview puedes usar la URL `*.vercel.app` si UploadThing lo permite en tu plan).

---

## 4. Vercel

1. **New Project** → importa el repositorio.
2. **Framework Preset:** Next.js.
3. **Build & Output:**
   - **Install command:** `pnpm install`
   - **Build command:** `pnpm build`
   - **Output:** por defecto Next.js (no cambiar salvo que sepas lo que haces).
4. **Environment Variables** (Production — y Preview si quieres previews con otro Convex):

   | Variable | Dónde obtenerla |
   |----------|------------------|
   | `NEXT_PUBLIC_CONVEX_URL` | Convex Dashboard → deployment prod → URL |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys |
   | `CLERK_SECRET_KEY` | Clerk → API Keys |
   | `UPLOADTHING_TOKEN` | UploadThing dashboard |
   | `NEXT_PUBLIC_CLERK_ISSUER_URL` | Opcional; misma issuer URL que en Convex |

   No subas secretos al repo; solo en Vercel / Convex.

5. **Deploy.** Enlaza en Vercel tu **dominio custom** (desde el dashboard de Vercel → Domains) para que coincida con el que diste en Clerk Production.

---

## 5. Convex después del primer deploy

- Cada cambio en **`convex/schema.ts`** o funciones Convex debe publicarse con:  
  `npx convex deploy`  
  (idealmente en CI o antes de considerar producción actualizada).

---

## 6. Verificación rápida

1. Abre la URL de Vercel → debe cargar sin error de `Missing NEXT_PUBLIC_CONVEX_URL`.
2. **Sign-in** con Clerk → sesión estable y rutas protegidas coherentes.
3. Crea una inspección de prueba → guardado en Convex.
4. Sube una foto en un ítem del checklist → debe completarse sin error de UploadThing (revisa red y token).
5. **Admin** (si aplica): PDF / permisos según rol en Convex.

---

## Referencias internas

- Auth Clerk ↔ Convex: [`docs/CLERK_CONVEX_AUTH.md`](./docs/CLERK_CONVEX_AUTH.md)
- Convex en este repo: [`convex/README.md`](./convex/README.md)

---

## Notas

- **`pnpm convex:dev`** es para desarrollo local contra Convex dev; en CI/Vercel no hace falta para el build de Next si solo usas el cliente con `NEXT_PUBLIC_CONVEX_URL`.
- Si el build falla por tipos, ejecuta localmente **`pnpm build`** y corrige antes de redeploy.
