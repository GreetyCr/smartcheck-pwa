# Smartcheck PWA

PWA de inspección vehicular para **Smartcheck** (Costa Rica). La app está centrada en que **Esteban** (dueño) pueda realizar reportes de inspección pre-compra. Smartcheck ya tiene su sitio web; esta es solo la PWA.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS** + **Shadcn/ui**
- **Convex** (BaaS) — por integrar
- **Clerk** (Auth, solo Google Sign-In) — por integrar
- **UploadThing** (imágenes) — por integrar
- **@serwist/next** (PWA/offline) — por integrar
- **Vercel** (deploy)

## Requisitos

- Node.js 20.9+
- pnpm

## Cómo correr el proyecto

```bash
pnpm install
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000). Build: `pnpm build`. Producción: `pnpm start`. Lint: `pnpm lint`. Tests: `pnpm test`.

Si **`npm install`** falla con `Cannot read properties of null (reading 'matches')`, suele deberse a mezclar **npm** con un árbol **`pnpm`** (`pnpm-lock.yaml`). Usa **`pnpm install`** o elimina `node_modules` y vuelve a instalar con un solo gestor.

## Estructura básica

- `app/(auth)/` — sign-in (Clerk), layout de auth
- `app/(dashboard)/` — dashboard principal, inspecciones (lista, nueva, [id], pdf), admin
- `app/api/uploadthing/` — API UploadThing (stub)
- `app/~offline/` — fallback offline
- `app/sw.ts`, `app/manifest.ts` — PWA (Serwist)
- `components/ui/` — Shadcn
- `components/inspection/` — ClientForm, VehicleForm, SectionCard, InspectionItem, PhotoCapture, VoiceInput, ProgressBar
- `components/layout/` — Header, MobileNav, OfflineIndicator
- `components/providers/` — ConvexClientProvider (`ClerkProvider` en `app/layout.tsx` desde `@clerk/nextjs`)
- `convex/` — schema, users, inspections, sections, images (stubs)
- `lib/` — utils, uploadthing, offline (db, sync), pdf (generator)
- `hooks/` — useOnlineStatus, useInspection, useSyncQueue
- `types/` — tipos globales

## Colores corporativos (Smartcheck)

- **Primary:** #1E3A5F | **Accent:** #FF8C00 | **Success:** #28A745 | **Warning:** #FFB347 | **Danger:** #DC3545 | **Background:** #F8F9FA  

En `app/globals.css`; uso vía Tailwind: `bg-primary`, `text-accent`, `bg-success`, etc.

## Licencia

Privado — Smartcheck.
