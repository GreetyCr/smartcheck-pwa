/**
 * La conciliación — el titular contaba una cosa y el umbral marcaba otra.
 *
 * Es el defecto que estrenó el patrón «el resumen contesta otra pregunta que la
 * que hace el rótulo»: el subtítulo promete marcar a partir del 5%, la lista
 * marcaba 10 de 14 meses, y el titular decía «2» — los de signo negativo.
 * Ninguna de las dos frases era falsa por separado.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ConciliacionCard } from "./ConciliacionCard";
import type { Reconciliation } from "./types";

function mes(ym: string, gapAbs: number, significant: boolean, enCurso = false) {
  return {
    yearMonth: ym,
    inspectionsIncome: 1_000_000,
    inspectionsCount: 20,
    financeIncome: 1_000_000 + gapAbs,
    gapAbs,
    gapPct: 10,
    significant,
    enCurso,
    autoCaptura: true,
  };
}

function datos(meses: Reconciliation["months"]): Reconciliation {
  return {
    months: meses,
    totals: {
      inspectionsIncome: 10_000_000,
      financeIncome: 11_000_000,
      gapAbs: 1_000_000,
      gapPct: 9.1,
      significant: true,
      gapAbsMesesCerrados: 1_000_000,
      gapPctMesesCerrados: 9.1,
    },
    thresholdPct: 5,
    financeStartISO: "2025-07-01",
    primerMesAutoCaptura: "2026-06",
    note: "",
  };
}

describe("ConciliacionCard", () => {
  test("el titular cuenta los que se pasan del umbral, no solo los negativos — A149", () => {
    /**
     * Diez marcados y dos negativos. Antes decía «2 meses tienen revisiones que
     * no aparecen en la contabilidad» encima de una lista con diez marcas.
     */
    const meses = [
      ...Array.from({ length: 8 }, (_, i) => mes(`2026-0${i + 1}`, 500_000, true)),
      mes("2026-09", -500_000, true),
      mes("2026-10", -500_000, true),
      mes("2026-11", 1_000, false),
    ];
    render(<ConciliacionCard data={datos(meses)} />);

    const titular = screen.getByText(/se pasan del 5%/);
    expect(titular.textContent).toMatch(/10 meses se pasan del 5%/);
    expect(titular.textContent).toMatch(/en 2 meses hay revisiones/);
  });

  test("sin negativos dice solo cuántos se pasan", () => {
    const meses = [mes("2026-01", 500_000, true), mes("2026-02", 100, false)];
    render(<ConciliacionCard data={datos(meses)} />);

    expect(screen.getByText(/1 mes se pasa del 5% de diferencia/)).toBeTruthy();
  });

  test("con todo dentro del margen lo dice, y no cuenta negativos", () => {
    // Un mes puede tener gap negativo sin pasarse del umbral: eso NO es una
    // alarma, y antes el titular se disparaba igual.
    const meses = [mes("2026-01", -1_000, false), mes("2026-02", 500, false)];
    render(<ConciliacionCard data={datos(meses)} />);

    expect(screen.getByText(/quedan dentro del margen/)).toBeTruthy();
  });

  test("el porcentaje dice sobre qué se calcula — A157", () => {
    // «₡X más que las revisiones … un 10,9%» y ese % es sobre la contabilidad:
    // el denominador era el otro número de la misma frase.
    render(<ConciliacionCard data={datos([mes("2026-01", 500_000, true)])} />);
    expect(
      screen.getAllByText(/de lo que registra la contabilidad/).length,
    ).toBeGreaterThan(0);
  });

  test("la tabla tiene caption y scope — A157", () => {
    // La de al lado los tenía y ésta ninguno: mismo patrón, la vecina sin
    // arreglar.
    const { container } = render(
      <ConciliacionCard data={datos([mes("2026-01", 500_000, true)])} />,
    );
    expect(container.querySelector("caption")).not.toBeNull();
    const ths = [...container.querySelectorAll("th")];
    expect(ths.length).toBeGreaterThan(0);
    expect(ths.every((th) => th.getAttribute("scope") === "col")).toBe(true);
  });
});
