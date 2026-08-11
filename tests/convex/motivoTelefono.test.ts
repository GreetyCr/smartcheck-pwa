/**
 * Ata el clasificador de motivos al texto que realmente emite el normalizador.
 *
 * `motivoTelefono()` deduce el motivo leyendo la **prosa** del `detail` del issue
 * (`includes("PSID")`, `includes("no-CR")`…). Funciona, pero acopla un código que
 * el tablero trata como estable a un mensaje pensado para leerse: si alguien
 * reescribe una tilde en "primer dígito", esas filas caen en `otro` **sin que
 * nada falle**. El tablero aguanta —muestra el código crudo en vez de romperse—,
 * y ese es justo el problema: se degrada en silencio.
 *
 * Esta prueba convierte ese silencio en un fallo ruidoso. No comprueba mi copia
 * de los textos: hace pasar entradas reales por el normalizador de verdad y
 * clasifica lo que ESE emite. Si cambia el mensaje, esto se cae y hay que venir
 * a decidir a propósito, en vez de enterarse por un tablero mal rotulado.
 *
 * (La solución de fondo sería guardar el motivo como campo al detectar el issue,
 * en vez de reconstruirlo después. Queda anotado; esto lo cubre mientras tanto.)
 */
import { describe, expect, test } from "vitest";
import { normalizePhone } from "../../convex/bi/leadsSync";
import { motivoTelefono } from "../../convex/bi/leads";

/** Entradas reales del tipo que llega de Airtable, con el motivo que esperamos. */
const CASOS: Array<[nombre: string, entrada: string, motivo: string]> = [
  ["PSID de Messenger/IG", "6123456789012345", "psid"],
  ["número de otro país", "12125551234", "no_cr"],
  ["placeholder de dígitos repetidos", "88888888", "placeholder"],
  ["primer dígito fuera del rango CR", "12345678", "primer_digito"],
  ["longitud imposible", "1234", "longitud"],
];

describe("motivoTelefono ↔ normalizePhone", () => {
  test.each(CASOS)("%s → %s", (_nombre, entrada, esperado) => {
    const { issue } = normalizePhone(entrada);
    expect(issue, `"${entrada}" debería producir un aviso`).not.toBeNull();
    expect(issue.type).toBe("anomalous_phone");
    expect(motivoTelefono(issue.detail)).toBe(esperado);
  });

  test("un teléfono CR válido no genera aviso", () => {
    const { phoneValid, issue } = normalizePhone("88776655");
    expect(phoneValid).toBe(true);
    expect(issue).toBeNull();
  });

  test("un +506 de 8 dígitos es costarricense: se le quita el 506 y NO es anómalo", () => {
    // Es la primera pregunta que hace Esteban al ver la lista de teléfonos raros.
    const { phone8, phoneValid, issue } = normalizePhone("+506 8877 6655");
    expect(phone8).toBe("88776655");
    expect(phoneValid).toBe(true);
    expect(issue).toBeNull();
  });

  test("un motivo desconocido cae en `otro`, no revienta", () => {
    expect(motivoTelefono("algo que nadie escribió nunca")).toBe("otro");
    expect(motivoTelefono(undefined)).toBe("otro");
  });
});
