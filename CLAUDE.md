# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

**Usar `pnpm`, no `npm`.** Hay `pnpm-lock.yaml` y mezclar gestores rompe el arbol de `node_modules` con un `Cannot read properties of null (reading 'matches')` que no se explica solo.

```sh
pnpm install
pnpm dev            # Next 16 + Turbopack
pnpm build          # tambien es el type-check real del proyecto
pnpm lint
pnpm test           # vitest run
pnpm convex:dev     # watch + push + codegen contra el deployment de desarrollo
pnpm convex:once    # una sola pasada
```

Un test suelto o un patron:

```sh
pnpm test tests/convex/payroll.test.ts
pnpm test -t "nombre del caso"
```

`vitest.config.mjs` asigna entorno por ruta: `tests/convex/**` corre en **edge-runtime** (es el runtime de Convex), `hooks/__tests__/**` en **happy-dom**, y todo lo demas en node. Un test de Convex movido fuera de `tests/convex/` deja de tener el runtime correcto y falla por razones que no tienen que ver con el codigo.

## Dos productos en una app

- **PWA del tecnico** — `app/(dashboard)/`: crear y llenar inspecciones en campo, offline, con fotos y PDF.
- **Panel BI / admin** — `app/(admin)/admin/`: finanzas, planilla, leads, canales, calidad, operacion. Lo usa Esteban (el dueno), no los tecnicos.

Comparten Convex, Clerk y layout base, pero son superficies distintas con permisos distintos. `app/(auth)/` es Clerk.

## Backend (Convex)

`convex/schema.ts` (~850 lineas) tiene tres familias de tablas:

- **Inspecciones:** `inspections` + una tabla `section_*` por seccion del informe (motor, transmision, frenos, ... ~20), cada una ligada por `inspectionId`. El catalogo de secciones e items manda sobre el esquema, no al reves. Tipos de respuesta reutilizables (`bien/reparacion/na`, `si/no/na`) definidos arriba del archivo.
- **BI:** `finance_entries`, `payroll_months`, `bi_matches`, `bi_quality_issues`, `bi_meta`, `bi_sheet_contrast`, `leads_contacts`, `inspections_legacy`.
- **Bot:** `bot_settings`.

Funciones en `convex/bi/` (tableros), `convex/bots/` (chatbot A37), `convex/lib/` (auth y validacion compartida).

**Auth.** Clerk sincroniza a la tabla `users` por webhook (`/clerk-webhook`, firma svix). El **primer usuario de la BD queda `admin`**, el resto `tecnico`. Los helpers viven en `convex/lib/auth.ts` (`requireAuth`, `requireAdmin`, `canAccessInspection`, ...); usarlos en vez de leer `ctx.auth` a mano.

**Superficie HTTP.** `convex/http.ts` expone dos cosas con auth distinta: `/clerk-webhook` (svix) y `/leads/*` + `/bot/*` para n8n/ManyChat (token compartido en `N8N_INGEST_TOKEN`, comparado en tiempo constante y **nunca logueado** — ver `convex/lib/apiAuth.ts`).

**Crons** (`convex/crons.ts`): sync semanal de leads desde Airtable (interino hasta el cutover a full-Convex; se apaga con `AIRTABLE_SYNC_DISABLED="true"`) y contraste semanal contra la hoja de calculo.

## Local-first

El flujo de creacion de inspecciones es local-first: se escribe en IndexedDB y una cola sincroniza a Convex.

- `lib/offline/db.ts` — base `smartcheck-pwa-offline`, **version 2**. Tocar el esquema exige subir `DB_VERSION` y una migracion; los errores de migracion se loguean con prefijo `[offline-db]` (catalogo en `lib/offline/README.md`).
- `lib/types/clientId.ts` — `ClientId` es un **branded type**: UUID estable del borrador, el que va en la URL y en el sync. No es `Id<"inspections">` ni `clerkId`; el brand existe justo para que no se mezclen. Invariante: `localId === clientId`.
- `lib/offline/syncQueue.ts` — drena borradores y fotos hacia `api.inspections.createOrUpdateFromDraft`.
- `components/inspection/InspectionRouteResolver.tsx` — el segmento de `/inspecciones/<ref>` puede ser un UUID local o un id legacy de Convex; el resolver decide.

**Feature flag `NEXT_PUBLIC_USE_UNIFIED_DRAFT_FLOW`** (`lib/featureFlags.ts`). Regla de rollback que esta escrita ahi y conviene no romper por intuicion: el flag controla **solo la entrada** al flujo unificado. La cola de sync sigue drenando siempre, aunque el flag este en `false` — apagarlo no debe dejar borradores locales huerfanos.

## Gotchas verificados

**El deploy de Convex es manual y va ANTES del frontend.** Vercel despliega Next solo con el push; Convex no. Cualquier cambio en `convex/` o en `schema.ts` necesita `npx convex deploy` a mano. Si sale primero el frontend, la UI llama funciones que todavia no existen.

**`app/dev/*` son paginas de revision visual, no rutas muertas.** Renderizan los mismos componentes con datos de muestra, sin login y sin escribir nada, para aprobar diseno por link. La guarda es `process.env.VERCEL_ENV === "production"` → `notFound()`, y **es a proposito que no use `NODE_ENV`**: los Previews de Vercel tambien compilan como `production`. Existen porque los Previews no autentican — llevan llaves Clerk de produccion, atadas al dominio real.

**Los endpoints HTTP viven en `.convex.site`, no en `.convex.cloud`.** Mismo deployment, otro dominio. Pegarle al equivocado da un error que se lee como problema de credenciales sin serlo.

**`next.config.ts` fija `turbopack.root` a proposito.** Si hay otro `package.json` o lockfile en una carpeta padre (por ejemplo en `~`), Next infiere mal la raiz, **no carga `proxy.ts`** y Clerk falla con "can't detect clerkMiddleware()". Mismo motivo para los `resolveAlias` de `tailwindcss`/`shadcn`. Ver `docs/RESOLUCION_MODULOS.md`.

**El middleware se llama `proxy.ts`, no `middleware.ts`** (convencion de Next 16). Su `matcher` lista explicitamente `/icons/:path*` y `/manifest.webmanifest` porque el patron por defecto excluye esas extensiones y luego el layout las revienta al llamar `auth()`.

**El on/off del bot tiene dos niveles y solo uno sirve.** El **global** vive en `bot_settings` y es confiable; el **por-lead** (`leads_contacts.chatbotActive`) lo pisa el sync semanal de Airtable todos los lunes, asi que no se expone en la UI. Ademas, si no hay fila de configuracion la respuesta es **encendido**: apagar el bot tiene que ser siempre un acto explicito.

**ESLint baja varias reglas de `react-hooks` a `warn` a proposito** (`set-state-in-effect`, `refs`, `immutability`): con formularios + Convex + IndexedDB daban mas ruido que senal. No subirlas a `error` sin mirar cuanto rompen.

**`README.md` esta desactualizado.** Lista Convex, Clerk, UploadThing y Serwist como "por integrar" y todos llevan meses en produccion. La estructura que describe tampoco coincide ya con `app/`.

## De donde sale el "por que"

Los comentarios del codigo citan decisiones por id — `A35`, `A37`, `A56`, `A66`, `B17`... — y **ese registro no esta en este repo**: vive en `~/Developer/SmartCheck-BI-Proyecto/LOG.md`, una tabla markdown de ~130 KB. Para entender por que algo esta hecho asi, buscar el id ahi:

```sh
grep -n "A56" ~/Developer/SmartCheck-BI-Proyecto/LOG.md
```

Vale la pena antes de "arreglar" cualquier cosa que parezca arbitraria: buena parte de lo raro esta razonado ahi, con el incidente que lo origino.

`docs/` guarda lo operativo del proyecto (auth Clerk↔Convex, checklist de la migracion local-first, planes por PR). `convex/README.md` cubre variables de entorno, el JWT template `convex` de Clerk y los helpers de roles.

## Cierre de sesión: escribir la bitácora

Este repo es trabajo de **Costa Coders** y su registro de horas vive en el vault, no acá:

```
~/Documents/Obsidian Vault/2. Areas/Costa Coders/Operación/Bitácora/AAAA-MM.md
```

**Al cerrar una sesión de trabajo, añadí una línea al final de `## Sesiones`**, sin reemplazar nada:

```
- AAAA-MM-DD · ~Nh · <cliente> · <qué se hizo>
```

El cliente de este repo es **SmartCheck CR**. Si el trabajo fue interno de la agencia, es `Costa Coders`.

**Por qué importa:** es el único insumo que existe para saber cuánto toma de verdad cada cosa, y de
ahí sale el precio por proyecto y la revisión del plan de soporte. Sin esa línea, el trabajo ocurrió
pero no se puede cotizar.

Y si en la sesión se entregó algo o se cerró un compromiso, actualizalo también en
`Operación/Compromisos/`: `estado: entregado`, y volcá las horas a `horas_reales`. El tablero que lo
muestra todo es `Operación/Panel.md`.

> Las decisiones **técnicas de este proyecto** siguen yendo al log de este repo, no al vault. El vault
> indexa, no duplica. Solo las de negocio, marca o precio van a `3. Resources/Decisiones/`.
