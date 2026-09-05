"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FiltrosBar } from "@/components/bi/FiltrosBar";
import {
  argsDeFiltros,
  escribirFiltros,
  leerFiltros,
  type DimensionKey,
  type FiltrosBi,
} from "@/lib/bi-filtros";

/**
 * La barra global conectada a la URL y a Convex — **RF-02**.
 *
 * Se usa en dos partes, y a propósito:
 *
 *  - `useFiltrosBi(soporta)` da los **argumentos ya recortados** para la query
 *    de esa pantalla.
 *  - `<FiltrosGlobales soporta={…} />` pinta la barra.
 *
 * Están separados porque la página necesita los argumentos **antes** de
 * renderizar (para pedirle los datos a Convex) y la barra va **arriba** del
 * contenido. Un solo componente que hiciera las dos cosas obligaría a envolver
 * cada tablero.
 *
 * La lista `soporta` la declara cada pantalla y es lo que impide la mentira de
 * A64: lo que no está en la lista no se le manda a la query, y la barra lo
 * pinta apagado con «No aplica en esta pantalla».
 */
export function useFiltrosBi(soporta: readonly (DimensionKey | "periodo")[]) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filtros = useMemo(() => leerFiltros(sp), [sp]);

  const setFiltros = useCallback(
    (f: FiltrosBi) => {
      const qs = escribirFiltros(f).toString();
      // `replace` y no `push`: cada clic en un filtro no debería ser un paso
      // atrás del navegador. Volver de un tablero filtrado tiene que llevar a
      // la pantalla anterior, no a deshacer siete filtros de a uno.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  /**
   * `Date.now()` se congela por render y no por llamada: si se recalculara en
   * cada uso, dos queries de la misma pantalla podrían pedir rangos con unos
   * milisegundos de diferencia y Convex las trataría como suscripciones
   * distintas, recargando de más sin que nada cambie en pantalla.
   */
  const args = useMemo(
    () => argsDeFiltros(filtros, soporta, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtros, soporta.join(",")],
  );

  return { filtros, setFiltros, args };
}

export function FiltrosGlobales({
  soporta,
  notaPeriodo,
}: {
  soporta: readonly (DimensionKey | "periodo")[];
  /** Ver `FiltrosBar`: qué decir cuando el periodo se elige en otro control. */
  notaPeriodo?: string;
}) {
  const { filtros, setFiltros } = useFiltrosBi(soporta);
  const opciones = useQuery(api.bi.public.filterOptions, {});

  return (
    <FiltrosBar
      filtros={filtros}
      opciones={opciones ?? undefined}
      soporta={soporta}
      onCambiar={setFiltros}
      onLimpiar={() => setFiltros({ periodo: "todo" })}
      notaPeriodo={notaPeriodo}
    />
  );
}
