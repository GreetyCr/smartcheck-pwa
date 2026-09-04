/**
 * Guarda del entorno del proyecto `lib` (ver `vitest.config.mjs`).
 *
 * `lib/**` corre en `node` a secas. Si algún día heredara DOM o edge-runtime,
 * estas pruebas dejarían de probar lo que creen probar.
 */
import { expect, test } from "vitest";

test("este proyecto corre en node, sin DOM ni edge-runtime", () => {
  expect(typeof document).toBe("undefined");
  expect(typeof (globalThis as Record<string, unknown>).EdgeRuntime).toBe(
    "undefined",
  );
  expect(typeof process.versions.node).toBe("string");
});
