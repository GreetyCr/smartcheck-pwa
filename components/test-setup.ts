/**
 * Limpieza del DOM entre pruebas de interfaz.
 *
 * `@testing-library/react` la registra sola **solo si Vitest corre con
 * `globals: true`**, y este repo lo tiene en `false` a propósito. Sin esto el
 * DOM se acumula entre `test()` y las consultas de `screen` encuentran nodos de
 * la prueba anterior: la primera versión de `BiCard.test.tsx` «falló» porque
 * buscaba encabezados y hallaba el de la prueba de arriba.
 *
 * Es un modo de falla feo — la prueba que rompe no es la que tiene el problema —
 * así que se resuelve una vez acá y no en cada archivo.
 */
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
