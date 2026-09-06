/**
 * Las tarjetas de número grande — lo que ya se rompió dos veces.
 *
 * Existe porque **los dos defectos que tuvo este componente eran invisibles a
 * las pruebas de negocio**: la cifra estaba bien, lo que fallaba era que el
 * texto que la explica se cortaba justo donde empieza a explicar. Eso no rompe
 * ninguna regla; rompe la lectura, y solo se ve mirando el render.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { BiKpiCard } from "./BiKpiCard";

describe("BiKpiCard", () => {
  test("el hint envuelve, no se trunca — A135 · A149", () => {
    /**
     * A135 sacó el `truncate` de la etiqueta de variación porque a 375 px se
     * comía «vs los 3 previos», que es lo único que la vuelve informativa. **No
     * lo sacó del hint**, y en A149 el hint pasó a llevar la base del cálculo:
     * «₡9.402 por revisión · sobre 586 de Mercadeo en los 14 meses con pauta».
     * Se leía «sobre 586 de Mercadeo e…».
     */
    render(
      <BiKpiCard
        label="Retorno de la pauta"
        value="6,61×"
        hint="₡9.402 por revisión · sobre 586 de Mercadeo en los 14 meses con pauta anotada"
      />,
    );
    const hint = screen.getByText(/sobre 586 de Mercadeo/);
    expect(hint.className).not.toMatch(/\btruncate\b/);
  });

  test("el monto exacto viaja además del compacto — A133", () => {
    // «₡4,55M» se leyó como 4.555.000 cuando eran 4.546.000, comparando contra
    // la hoja. Desde entonces la cifra exacta va debajo, siempre.
    render(
      <BiKpiCard label="Ingresos" value="₡4,55M" exact="₡4.546.000" />,
    );
    expect(screen.getByText("₡4.546.000")).toBeTruthy();
  });

  test("sin hint no se pinta una línea vacía", () => {
    const { container } = render(<BiKpiCard label="Revisiones" value="912" />);
    expect(container.textContent).toBe("Revisiones912");
  });
});
