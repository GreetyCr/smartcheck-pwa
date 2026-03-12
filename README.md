# Smartcheck PWA

PWA de inspección vehicular para **Smartcheck**, empresa costarricense de inspección pre-compra de vehículos.

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
# Instalar dependencias
pnpm install

# Desarrollo
pnpm dev

# Build
pnpm build

# Producción
pnpm start

# Lint
pnpm lint
```

Abrir [http://localhost:3000](http://localhost:3000).

## Estructura (por dominio)

- `src/app/(marketing)/` — landing y páginas públicas
- `src/app/(auth)/` — inicio de sesión (Clerk)
- `src/app/(app)/` — área principal (dashboard, inspecciones, etc.)

## Colores corporativos (Smartcheck)

- **Primary:** #1E3A5F  
- **Accent:** #FF8C00  
- **Success:** #28A745  
- **Warning:** #FFB347  
- **Danger:** #DC3545  
- **Background:** #F8F9FA  

Definidos en `src/app/globals.css` y usables vía Tailwind (`bg-primary`, `text-accent`, `bg-success`, etc.).

## Licencia

Privado — Smartcheck.
