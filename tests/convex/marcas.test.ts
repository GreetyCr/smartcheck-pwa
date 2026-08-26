/**
 * Unificación de la marca del vehículo (RF-02).
 *
 * El CRM viejo guarda marca, modelo y año pegados en texto libre —530 valores
 * distintos para 742 filas—, y la app tiene una lista cerrada de 14. Sin
 * unificar, el filtro por marca de la barra global sería una lista de 530
 * opciones, o dejaría fuera 742 de las 887 revisiones.
 *
 * Lo que se fija acá es que **lo que no se reconoce se pueda contar**: cae en
 * `(sin marca)`, que es un valor visible del filtro. Es la regla de A64 — el
 * hueco tiene que hacer ruido, no repartirse en silencio entre las demás.
 */
import { describe, expect, test } from "vitest";
import { canonicalBrand, SIN_MARCA } from "../../convex/bi/lib/marcas";

describe("marca canónica", () => {
  test("del CRM viejo se queda solo la marca, sin modelo ni año", () => {
    expect(canonicalBrand("Hyundai Tucson 2017")).toBe("Hyundai");
    expect(canonicalBrand("Toyota Rav4")).toBe("Toyota");
    expect(canonicalBrand("Honda CRV")).toBe("Honda");
  });

  test("la app, que ya viene limpia, no se toca", () => {
    expect(canonicalBrand("Hyundai")).toBe("Hyundai");
    expect(canonicalBrand("Mercedes-Benz")).toBe("Mercedes-Benz");
  });

  test("las erratas reales de producción se resuelven", () => {
    // Las cinco filas de `hyudai` valen tanto como las 146 de `hyundai`:
    // sin esto, «Hyundai» aparecería 5 revisiones más chico de lo que es.
    for (const t of ["hyudai", "Hyudnai Tucson", "HIUNDAY"]) {
      expect(canonicalBrand(t), t).toBe("Hyundai");
    }
    expect(canonicalBrand("Mitusbishi Montero")).toBe("Mitsubishi");
    expect(canonicalBrand("Chevorlet Captiva")).toBe("Chevrolet");
    expect(canonicalBrand("for mustang")).toBe("Ford");
  });

  test("las marcas de dos palabras no se parten", () => {
    // «Range Rover» y «Land Rover» son la misma marca escrita de dos formas.
    expect(canonicalBrand("Range Rover Evoque")).toBe("Land Rover");
    expect(canonicalBrand("Land Rover Discovery")).toBe("Land Rover");
    expect(canonicalBrand("Great Wall Haval")).toBe("Great Wall");
  });

  test("un modelo escrito sin su marca igual se resuelve", () => {
    // «Tucson 2019» sin la palabra Hyundai adelante. Son ~13 filas en PROD.
    expect(canonicalBrand("Tucson 2019")).toBe("Hyundai");
    expect(canonicalBrand("Santa Fe")).toBe("Hyundai");
    expect(canonicalBrand("Vitara")).toBe("Suzuki");
    expect(canonicalBrand("Terios 2016")).toBe("Daihatsu");
  });

  test("lo que NO se reconoce cae en «sin marca» y se puede contar", () => {
    // Casos reales: una placa, la transmisión, y el campo vacío. Ninguno se
    // reparte entre las marcas de verdad.
    for (const t of ["BYQ946", "automatico", "que", "", null, undefined]) {
      expect(canonicalBrand(t as string), String(t)).toBe(SIN_MARCA);
    }
  });

  test("una marca nueva que nadie mapeó NO se disfraza de otra", () => {
    // El caso que discrimina: si el fallback fuera «Otro» o la marca más
    // parecida, una marca nueva entraría al tablero sin que nadie se entere.
    expect(canonicalBrand("Cupra Formentor")).toBe(SIN_MARCA);
  });
});
