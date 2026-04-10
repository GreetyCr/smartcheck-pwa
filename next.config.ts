import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Raíz real del proyecto (carpeta de este archivo).
 * Si hay otro package-lock.json en un directorio padre, Next/Turbopack puede
 * inferir mal la raíz y NO cargar middleware/proxy ni resolver rutas bien.
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory
 */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Evita que el resolver suba a un `package.json` en carpetas padre (p. ej. `~/package.json`)
 * y falle al resolver `@import "tailwindcss"` desde `app/globals.css`.
 * @see docs/RESOLUCION_MODULOS.md
 */
const nodeModules = (...segments: string[]) =>
  path.join(projectRoot, "node_modules", ...segments);

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss: nodeModules("tailwindcss"),
      "tw-animate-css": nodeModules("tw-animate-css"),
      shadcn: nodeModules("shadcn"),
    },
  },
};

export default nextConfig;
