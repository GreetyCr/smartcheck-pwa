/**
 * El marco de todas las tarjetas del panel.
 *
 * Una sola prueba, y no es cosmética: el nivel del título decide el orden de
 * encabezados de la página entera.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { BiCard } from "./BiCard";

describe("BiCard", () => {
  test("titula con h2 por omisión", () => {
    render(<BiCard title="Qué trae cada canal">contenido</BiCard>);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Qué trae cada canal",
    );
  });

  test("con titleAs=\"p\" no aporta encabezado — A157", () => {
    /**
     * El interruptor del bot se pinta **antes** del `h1` de Leads. Con un `h2`
     * ahí, la página abría con dos encabezados de nivel 2 antes del 1, y un
     * lector de pantalla los anuncia como secciones de algo que no empezó
     * (WCAG 1.3.1).
     */
    render(
      <BiCard title="Bot de WhatsApp" titleAs="p">
        contenido
      </BiCard>,
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Bot de WhatsApp")).toBeTruthy();
  });
});
