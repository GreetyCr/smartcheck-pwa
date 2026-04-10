# Clerk + Convex: auth y errores frecuentes

## 0. Síntomas juntos: warning de Convex + `No autenticado` en mutations

Si al cargar la app ves **"No auth provider found matching the given token"** y al llamar a **`createDraft`** u otras mutations aparece **`No autenticado`** en `requireAuth`, es **la misma causa**: Convex **no valida el JWT**, así que `ctx.auth.getUserIdentity()` queda vacío.

**Qué hacer (orden recomendado):**

1. En **Clerk Dashboard → API Keys** de la app que usa tu PWA, copia la **Frontend API URL** (ej. `https://TU-INSTANCIA.clerk.accounts.dev`).
2. En **Convex Dashboard → Settings → Environment Variables**, pon **`CLERK_JWT_ISSUER_DOMAIN`** = esa URL **exacta**, sin barra final.
3. Esa misma app de Clerk debe ser la de tus variables en **`.env.local`**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`. Si las keys son de **otra** instancia, el `iss` del token no coincidirá con lo que Convex espera (aunque el mensaje de error mencione un dominio concreto, ese dominio es solo **el configurado en Convex**, no el de tu token).
4. Activa la **integración Convex en Clerk** (o template JWT `convex` con **`aud: "convex"`**). Sin `aud` correcto, Convex sigue rechazando el token.
5. Tras cambiar variables en Convex: **`pnpm convex:dev`** o **`pnpm convex:once`** y recarga la app.

En desarrollo, abre **`/dev/jwt`**, pulsa **"Token que usa Convex"** y revisa **`iss`** y **`aud`**. Opcional: en `.env.local` añade  
`NEXT_PUBLIC_CLERK_ISSUER_URL=https://…` (la misma Frontend API URL) para que la página compare y marque si coincide.

---

## 1. `No auth provider found matching the given token` (issuer / audience)

El mensaje suele incluir el proveedor **que Convex tiene configurado ahora**, por ejemplo:

`OIDC(domain=https://TU-INSTANCIA.clerk.accounts.dev, app_id=convex)`

Eso **no** es el issuer de tu token: indica qué dominio Convex espera. Tu JWT debe tener **`iss`** exactamente igual a ese dominio (Frontend API URL de Clerk, sin `/` final).

**Si acabas de cambiar de app de Clerk** (otras `NEXT_PUBLIC_CLERK_*` en `.env.local`):

1. Abre **Clerk Dashboard → tu app actual → API Keys** y copia la **Frontend API URL** (p. ej. `https://current-ringtail-58.clerk.accounts.dev`).
2. En **Convex Dashboard → Settings → Environment Variables**, pon **`CLERK_JWT_ISSUER_DOMAIN`** = esa URL (sin barra final).
3. Vuelve a desplegar o ejecuta `pnpm convex:dev` / `pnpm convex:once` para que `auth.config.ts` lea el valor.

Hasta que **`iss` del JWT** y **`CLERK_JWT_ISSUER_DOMAIN`** coincidan con la **misma** app de Clerk que usas en Next, seguirás viendo el error.

Convex valida el JWT con lo configurado en **`convex/auth.config.ts`** y en el **Dashboard de Convex** (Settings → Authentication / variables de entorno).

Convex comprueba **dos cosas del payload** del JWT ([guía oficial de depuración](https://docs.convex.dev/auth/debug#step-3-check-that-backend-configuration-matches-frontend-configuration)):

| Claim | Debe coincidir con |
|--------|---------------------|
| **`iss`** | El **Domain** (o `CLERK_JWT_ISSUER_DOMAIN`) = **Frontend API URL** de Clerk, p. ej. `https://adequate-macaw-37.clerk.accounts.dev` (sin barra final al final) |
| **`aud`** | El **Application ID** en Convex = **`convex`** (el literal `"convex"`, igual que `applicationID` en `auth.config.ts`) |

Si **`iss`** está bien pero **`aud` no es `convex`**, seguirás viendo el error aunque “todo lo demás” esté bien.

### Causa típica: template JWT manual sin `aud` correcto

Solo crear un JWT template llamado **`convex`** **no** garantiza que Clerk ponga `aud: "convex"`.

**Opción A (recomendada):** en Clerk, activa la integración oficial:

1. [Clerk Dashboard → Convex integration](https://dashboard.clerk.com/apps/setup/convex)  
2. **Activate Convex integration**  
3. Clerk documenta que en **Sessions → Claims** el **`aud`** que Convex necesita queda **pre-mapeado** al activar la integración ([docs Clerk](https://clerk.com/docs/guides/development/integrations/databases/convex)).

**Opción B:** en el template JWT **`convex`**, en **Claims** (JSON personalizado), asegura que exista audiencia para Convex, por ejemplo:

```json
{
  "aud": "convex"
}
```

(Ajusta según la UI de Clerk; a veces `aud` viene como array o con otros valores si no usas la integración.)

### Qué más revisar

1. **Misma aplicación de Clerk** que las keys de Next (`.env.local`): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

2. **`CLERK_JWT_ISSUER_DOMAIN` en Convex** = **Frontend API URL** de esa app (sin `/` final).

3. Tras cambiar `auth.config.ts` o variables: `pnpm convex:dev` o `pnpm convex:once`.

4. **Inspección rápida del token:** en local abre **`/dev/jwt`**, obtén el token del template `convex` y revisa `iss` y `aud` (o pégalo en jwt.io).

### JWT Template en Clerk

- Nombre: **`convex`** (minúsculas) — es el que usa `ConvexProviderWithClerk` con `getToken({ template: "convex" })`.
- **No** confundir el **ID `jtmp_...`** del template con el JWT; el ID es solo interno de Clerk.

---

## 2. `auth() was called but Clerk can't detect clerkMiddleware()` (p. ej. `/icons/icon-192.png`)

El `matcher` típico de Clerk **excluye** `.png`, `.webmanifest`, etc. Si esa URL entra al App Router (icono faltante en `public`, manifest, etc.) y el layout usa `auth()`, Clerk falla porque el middleware **no corrió** para esa ruta.

En este repo, `proxy.ts` incluye matchers explícitos: `/icons/:path*` y `/manifest.webmanifest`.

**Next.js 16:** solo debe existir **`proxy.ts`** (no `middleware.ts` a la vez; el build falla si hay ambos).

También puede ocurrir si **Next infiere mal la raíz** (otro `package-lock.json` en un padre): asegúrate de **`turbopack.root`** en `next.config.ts` y de ejecutar `pnpm dev` desde **`smartcheck-pwa`**.

---

## 3. Usuarios en tabla `users` de Convex

El webhook **no usa el JWT**; sincroniza con el **Signing Secret** y la URL  
`https://<deployment>.convex.site/clerk-webhook`.

Si no aparecen filas en `users`:

- Clerk Dashboard → **Webhooks** → comprobar entregas y errores.
- Convex Dashboard → **Logs** del deployment.
- Variable **`CLERK_WEBHOOK_SECRET`** en Convex = el secret del endpoint en Clerk.
