import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Un proyecto por entorno. Antes esto era `environmentMatchGlobs`, que Vitest
 * dejó obsoleto: el día que desaparezca, los tests de Convex correrían en el
 * runtime equivocado y el error no se parecería en nada a la causa.
 *
 * El entorno NO es decorativo: `tests/convex/**` necesita `edge-runtime`
 * porque ese es el runtime de Convex, y `hooks/__tests__/**` necesita DOM.
 * Un test de Convex movido fuera de `tests/convex/` deja de tener el runtime
 * correcto y falla por razones que no tienen que ver con el código.
 *
 * `extends: true` hace que cada proyecto herede de este archivo el alias `@`
 * y las variables de `env`; sin eso habría que repetirlos tres veces.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    globals: false,
    passWithNoTests: true,
    env: {
      N8N_WEBHOOK_DISABLED: "true",
      CLERK_JWT_ISSUER_DOMAIN: "https://test.clerk.accounts.dev",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["tests/convex/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "hooks",
          environment: "happy-dom",
          include: ["hooks/__tests__/**/*.test.tsx"],
        },
      },
      {
        /**
         * **La interfaz, que hasta el 6-set no tenía ni una prueba.**
         *
         * `components/**` y `app/**` no estaban en ningún glob, y eso explica el
         * dato más incómodo de la semana: de los 38 defectos de la revisión y
         * los 22 del QA, **las 681 pruebas encontraron cero**. No es que fueran
         * malas — protegían reglas de negocio, que es su trabajo. Es que ninguno
         * de esos defectos rompía una regla: rompían **la lectura**, y eso vive
         * en el render.
         *
         * Lo que va acá no es cobertura por cobertura. Cada archivo fija un
         * defecto que ya ocurrió, con su id, para que la próxima vez el error
         * hable antes de llegar a la pantalla.
         */
        extends: true,
        test: {
          name: "ui",
          environment: "happy-dom",
          include: ["components/**/*.test.tsx"],
          setupFiles: ["components/test-setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "lib",
          environment: "node",
          include: ["lib/**/*.test.ts"],
        },
      },
    ],
  },
});
