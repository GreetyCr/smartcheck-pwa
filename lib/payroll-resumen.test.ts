/**
 * El mensaje que confirma qué pasó al guardar la planilla — A151.
 *
 * Existe porque el mensaje anterior **no rompía nada y mentía por omisión**:
 * decía «N líneas entraron a Finanzas» en cuanto se creaba alguna, y callaba las
 * corregidas. Corregir un mes ya registrado crea una y actualiza ocho, así que
 * informaba la mitad de menos — justo la que el usuario no necesita confirmar.
 *
 * Un mensaje mal armado no falla nunca, y por eso nadie lo mira dos veces.
 */
import { describe, expect, test } from "vitest";
import { resumen } from "@/components/bi/PayrollMonthCard";

describe("resumen del guardado de planilla", () => {
  test("dice las dos mitades cuando crea y corrige", () => {
    // El caso real de corregir un mes: la falla que motivó el arreglo.
    const t = resumen(1, 8);
    expect(t).toContain("1 línea");
    expect(t).toContain("8 corregidas");
  });

  test("no dice «1 líneas»", () => {
    expect(resumen(1, 0)).toContain("1 línea entraron");
    expect(resumen(1, 0)).not.toContain("1 líneas");
    expect(resumen(0, 1)).toContain("1 línea");
    expect(resumen(0, 1)).not.toContain("1 líneas");
  });

  test("un mes nuevo habla solo de las nuevas", () => {
    const t = resumen(9, 0);
    expect(t).toContain("9 líneas");
    expect(t).not.toMatch(/corregid/);
  });

  test("solo correcciones lo dice y aclara que no hubo nuevas", () => {
    const t = resumen(0, 8);
    expect(t).toContain("8 líneas");
    expect(t).toContain("ninguna nueva");
  });

  test("guardar sin cambios no se anuncia como éxito vacío", () => {
    // «Listo: 0 líneas entraron a Finanzas» se lee como que algo falló.
    expect(resumen(0, 0)).toContain("nada que cambiar");
  });
});
