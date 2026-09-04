/**
 * Guarda del entorno del proyecto `hooks` (ver `vitest.config.mjs`).
 *
 * `hooks/__tests__/**` corre en `happy-dom`: sin DOM, renderizar un hook de
 * React falla con un error que no menciona el entorno. Esta prueba sí.
 */
import { expect, test } from "vitest";

test("este proyecto corre en happy-dom, con DOM disponible", () => {
  expect(typeof document).toBe("object");
  expect(String(navigator.userAgent)).toContain("HappyDOM");
});
