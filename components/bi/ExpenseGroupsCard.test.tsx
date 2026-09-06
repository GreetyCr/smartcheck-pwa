/**
 * «En qué se va el gasto» — la tarjeta que Esteban usó para encontrar un defecto.
 *
 * Preguntó cómo verla por mes y usó el filtro de arriba. No pasó nada: la
 * tarjeta tenía **su propio control con las cuatro opciones idénticas**. Estas
 * pruebas fijan que no vuelva a tener uno, y que diga siempre sobre qué está
 * hecho el desglose.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ExpenseGroupsCard, rangoDelMes, type ExpenseBreakdown } from "./ExpenseGroupsCard";

const DATOS: ExpenseBreakdown = {
  categorias: ["otros"],
  totalCRC: 841_856,
  totalRows: 18,
  grupos: [
    {
      grupo: "servicios_profesionales",
      rows: 10,
      amountCRC: 700_000,
      pct: 83.1,
      etiquetas: [
        { etiqueta: "INCORPORATE", rows: 4, amountCRC: 500_000, pctGrupo: 71.4 },
      ],
    },
    { grupo: "software", rows: 8, amountCRC: 141_856, pct: 16.9, etiquetas: [] },
  ],
  sinClasificar: [],
};

describe("ExpenseGroupsCard", () => {
  test("NO tiene control de periodo propio — A158", () => {
    /**
     * Tenía uno con Todo · 12 · 6 · 3, **las mismas cuatro opciones** que la
     * barra de arriba, gobernando solo esta tarjeta. Dos controles iguales con
     * alcances distintos en la misma pantalla.
     */
    render(<ExpenseGroupsCard data={DATOS} alcance="julio 2026" />);
    expect(screen.queryByRole("group", { name: "Periodo" })).toBeNull();
    expect(screen.queryByText("12 meses")).toBeNull();
  });

  test("el subtítulo abre diciendo sobre qué está hecho — A158", () => {
    // Es la pregunta que originó el cambio: «¿y por mes?».
    render(<ExpenseGroupsCard data={DATOS} alcance="julio 2026" />);
    const sub = screen.getAllByText(/^julio 2026 ·/)[0];
    expect(sub.textContent).toMatch(/18 movimientos/);
  });

  test("sin alcance dice «Todo el periodo», nunca nada", () => {
    render(<ExpenseGroupsCard data={DATOS} />);
    expect(screen.getByText(/Todo el periodo ·/)).toBeTruthy();
  });

  test("dice que las barras se miden contra el grupo más grande — A157", () => {
    // La barra más larga siempre llena el carril, así que sin decirlo se lee
    // como «todo». Las proporciones entre barras sí corresponden.
    render(<ExpenseGroupsCard data={DATOS} alcance="julio 2026" />);
    expect(screen.getAllByText(/contra el grupo más grande/).length).toBeGreaterThan(0);
  });
});

describe("rangoDelMes", () => {
  test("cubre el mes entero y no se corre medio día — A158", () => {
    const { fromMs, toMs } = rangoDelMes("2026-07");
    // Medianoche de Costa Rica = 06:00 UTC.
    expect(new Date(fromMs).toISOString()).toBe("2026-07-01T06:00:00.000Z");
    expect(new Date(toMs).toISOString()).toBe("2026-08-01T06:00:00.000Z");
  });

  test("diciembre cruza al año siguiente", () => {
    const { toMs } = rangoDelMes("2026-12");
    expect(new Date(toMs).toISOString()).toBe("2027-01-01T06:00:00.000Z");
  });
});
