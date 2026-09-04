"use client";

import { useEffect, useState } from "react";

/**
 * Reloj que avanza solo.
 *
 * Existe porque leer `Date.now()` en el render —o dentro de un `useMemo`— deja
 * el valor congelado hasta que otra cosa provoque un render (`react-hooks/purity`).
 * En una etiqueta de "hace X min" eso no es un detalle: se queda diciendo
 * "hace 2 min" con veinte encima, justo cuando el dato importa.
 *
 * @param intervalMs cada cuánto avanza. `<= 0` → no tickea (valor fijo del montaje).
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs <= 0) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
