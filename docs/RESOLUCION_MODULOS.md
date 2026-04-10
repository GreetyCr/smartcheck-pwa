# Errores en bucle: `Can't resolve 'tailwindcss' in '.../Desktop'`

## Qué pasa

Si en la terminal aparece algo como:

- `Can't resolve 'tailwindcss' in '/Users/.../Desktop'`
- `using description file: /Users/<usuario>/package.json (relative path: ./Desktop)`

entonces **algún `package.json` fuera del repo** (típicamente en **`$HOME`**, tu carpeta de usuario) está haciendo que el bundler trate el directorio padre como “proyecto” y la resolución de módulos se rompa. Eso puede generar **miles de líneas en bucle** y colgar el dev server.

## Solución recomendada (rápida)

1. **Revisa si existe** `~/package.json` (y `~/package-lock.json`) **sin ser un monorepo real**.
2. Si solo tiene dependencias sueltas (por ejemplo solo `yarn`) y **no** es un proyecto que uses a propósito:
   - **Elimínalos** o **muévelos** a otra carpeta (backup), por ejemplo:
     ```bash
     mv ~/package.json ~/package.json.bak
     mv ~/package-lock.json ~/package-lock.json.bak
     ```
3. Vuelve a arrancar el frontend **desde la carpeta del proyecto**:
   ```bash
   cd /ruta/a/smartcheck-pwa
   pnpm dev
   ```

## Qué hace el repo

En `next.config.ts`, **`turbopack.root`** apunta a la carpeta del proyecto y hay **`resolveAlias`** para `tailwindcss`, `tw-animate-css` y `shadcn`, apuntando a `node_modules` **dentro** de `smartcheck-pwa`, para reducir el impacto de un `package.json` accidental en el home.

Aun así, lo más limpio es **no tener un `package.json` suelto en `$HOME`**.
