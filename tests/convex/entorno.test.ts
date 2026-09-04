/**
 * Guarda del entorno del proyecto `convex` (ver `vitest.config.mjs`).
 *
 * `tests/convex/**` corre en `edge-runtime` porque ese es el runtime de
 * Convex. Si esa asignación se rompe —al tocar la config, al migrar de
 * versión— los 30 archivos de este directorio fallan por razones que no se
 * parecen en nada a la causa. Esta prueba falla primero y lo dice con todas
 * las letras.
 */
import { expect, test } from "vitest";

test("este proyecto corre en edge-runtime, no en node", () => {
  expect(
    typeof (globalThis as Record<string, unknown>).EdgeRuntime,
  ).not.toBe("undefined");
  expect(typeof document).toBe("undefined");
});
