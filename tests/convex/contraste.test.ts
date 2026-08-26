/**
 * Contraste mensual hoja ↔ Convex (A56).
 *
 * **Todo el valor de esta función depende de que el parser no invente plata.**
 * Un contraste que reporta diferencias falsas se apaga a la semana, y entonces
 * el día que la hoja cambie de verdad no lo va a ver nadie. Las dos pruebas que
 * más pesan acá salen de errores reales que cometí en la primera corrida contra
 * la hoja de producción:
 *
 *  1. `$ -` se leía como «vacío» en vez de cero, así que el lector seguía
 *     buscando y **se llevaba el número de la columna siguiente** — que en mayo
 *     es la cantidad de viajes del técnico. Eran ₡3.
 *  2. `GASOLINA TECNICO` se contaba como gasto, y es **el subtotal de los
 *     viáticos de las cuatro semanas**. Eran ₡130.000.
 *
 * Juntos inventaban ₡130.003 en un mes que cuadraba perfecto. Y el segundo
 * tuvo un arreglo intermedio que **acertaba por el motivo equivocado** —cortar
 * la búsqueda en la columna D, o sea descartar esa fila por estar lejos en vez
 * de por ser un subtotal—; la prueba «un monto en una columna lejana SÍ cuenta»
 * está para que ese atajo no pueda volver.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import {
  numeroCR,
  parsearCSV,
  parsearPestana,
  pestanaAMes,
} from "../../convex/bi/contraste";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

/* ========================================================================== */

describe("de qué mes es cada pestaña", () => {
  test("las de 2025 no llevan año en el nombre", () => {
    expect(pestanaAMes("JULIO")).toBe("2025-07");
    expect(pestanaAMes("DICIEMBRE")).toBe("2025-12");
  });

  test("desde enero el nombre trae el año", () => {
    expect(pestanaAMes("ENERO 2026")).toBe("2026-01");
    expect(pestanaAMes("MARZO 2026")).toBe("2026-03");
  });

  test("las pestañas que no son meses quedan fuera", () => {
    // Son plantillas y bases auxiliares. Meterlas al contraste generaría
    // diferencias contra meses que no existen.
    for (const t of ["Dolares BD", "Colones BD", "IDEAL", "Copia de IDEAL", "Hoja 3"]) {
      expect(pestanaAMes(t), t).toBeNull();
    }
  });

  test("la proyección NO entra, aunque su nombre empiece con un año", () => {
    // «2026 PROYECCION JAKE» no es un mes cerrado: son números inventados a
    // futuro. Contrastarlos contra Convex daría una diferencia permanente.
    expect(pestanaAMes("2026 PROYECCION JAKE")).toBeNull();
  });

  test("una pestaña con un nombre que no reconocemos NO se adivina", () => {
    expect(pestanaAMes("Resumen")).toBeNull();
    expect(pestanaAMes("")).toBeNull();
  });
});

describe("leer números de la hoja", () => {
  test("locale de Costa Rica: punto para miles, coma para decimales", () => {
    expect(numeroCR(" $ 3.035.269,13 ")).toBe(3035269.13);
    expect(numeroCR("$40.000,00")).toBe(40000);
  });

  test("«$ -» es CERO, no vacío — el error que inventaba ₡3", () => {
    // El caso que discrimina. Con `null`, el lector de la fila sigue a la
    // columna siguiente, y en «BONOS EXTRAS» de mayo-2026 ahí vive un 3 que es
    // la CANTIDAD DE VIAJES, no plata.
    expect(numeroCR(" $ -   ")).toBe(0);
    expect(numeroCR("-")).toBe(0);
    expect(numeroCR("₡ —")).toBe(0);
  });

  test("una celda de verdad vacía sigue siendo vacía", () => {
    expect(numeroCR("")).toBeNull();
    expect(numeroCR("   ")).toBeNull();
    expect(numeroCR(undefined)).toBeNull();
    expect(numeroCR("R")).toBeNull();
  });

  test("los paréntesis son negativos, como en la hoja", () => {
    expect(numeroCR(" $ (2.685,00)")).toBe(-2685);
  });
});

describe("sumar una pestaña", () => {
  const csv = (t: string) => parsearPestana("2026-05", parsearCSV(t));

  test("separa ingresos de gastos por «GASTOS SIN IVA»", () => {
    const r = csv(
      `"SEMANA 1"," $ 100.000,00 "\n` +
        `"SEMANA 2"," $ 50.000,00 "\n` +
        `"TOTAL"," $ 150.000,00 "\n` +
        `"GASTOS SIN IVA",""\n` +
        `"INCORPORATE"," $ 70.000,00 "\n` +
        `"TOTAL"," $ 70.000,00 "\n` +
        `"UTILIDAD"," $ 80.000,00 "\n`,
    );
    expect(r.hojaIngreso).toBe(150000);
    expect(r.hojaGasto).toBe(70000);
    expect(r.totalIngreso).toBe(150000);
    expect(r.totalGasto).toBe(70000);
    expect(r.hojaFilas).toBe(3);
  });

  test("los SUBTOTALES no se suman: contarlos duplica la plata", () => {
    // Es literalmente el error que tiene la hoja en diciembre-2025, donde el
    // TOTAL suma dos veces `TOTAL FIJOS` y convierte un mes parejo en una
    // pérdida de $2.685.
    const r = csv(
      `"GASTOS SIN IVA",""\n` +
        `"SAFETY CULTURE"," $ 10.000,00 "\n` +
        `"INCORPORATE"," $ 20.000,00 "\n` +
        `"TOTAL FIJOS"," $ 30.000,00 "\n` +
        `"ADS"," $ 5.000,00 "\n` +
        `"TOTAL SEMANA"," $ 5.000,00 "\n` +
        `"TOTAL ADS"," $ 5.000,00 "\n` +
        `"TOTAL"," $ 35.000,00 "\n`,
    );
    expect(r.hojaGasto).toBe(35000);
    expect(r.hojaFilas).toBe(3);
  });

  test("una fila con «$ -» aporta CERO, y no el número de la columna de al lado", () => {
    // La fila real de mayo-2026: monto en guion y la cantidad de viajes tres
    // columnas más allá. Sin esto el contraste sumaba ₡3 y reportaba una
    // diferencia inexistente.
    const r = csv(
      `"GASTOS SIN IVA",""\n` +
        `"ADS"," $ 81.000,00 "\n` +
        `"BONOS EXTRAS"," $ -   ","CANTIDAD VIAJES EXTRA","3"\n` +
        `"TOTAL"," $ 81.000,00 "\n`,
    );
    expect(r.hojaGasto).toBe(81000);
  });

  test("los porcentajes y las bases de cálculo NO son plata", () => {
    // El layout de 2026 estira las filas: la provisión trae su monto, después
    // la base y después el porcentaje. Solo la primera es un gasto.
    const r = csv(
      `"GASTOS SIN IVA",""\n` +
        `"APORTE PATRONO CCSS"," $ 115.756,00 ","26,92%"\n` +
        `"PROVISION AGUINALDO"," $ 39.975,67 "," $ 479.900,00 ","8,33%"\n` +
        `"TOTAL"," $ 155.731,67 "\n`,
    );
    expect(r.hojaGasto).toBe(155731.67);
  });

  test("«GASOLINA TECNICO» NO es un gasto: es la suma de los viáticos de las semanas", () => {
    // La aritmética va en el escenario a propósito, porque es la evidencia:
    // 36.000 + 34.000 + 30.000 + 30.000 = 130.000, que es justo lo que dice
    // esa fila. Contarla suma la misma plata dos veces. La celda TOTAL de la
    // hoja y la migración original también la excluyen.
    const r = csv(
      `"GASTOS SIN IVA",""\n` +
        `"VIATICOS TECNICO"," $ 36.000,00 "\n` +
        `"VIATICOS TECNICO"," $ 34.000,00 "\n` +
        `"VIATICOS TECNICO"," $ 30.000,00 "\n` +
        `"VIATICOS TECNICO"," $ 30.000,00 "\n` +
        `"GASOLINA TECNICO","GASOLINA TECNICO"," $ 130.000,00 "\n` +
        `"TOTAL"," $ 130.000,00 "\n`,
    );
    expect(r.hojaGasto).toBe(130000);
    expect(r.hojaFilas).toBe(4);
  });

  test("«GASOLINA TECNICO» SÍ es un gasto cuando no hay viáticos que resumir", () => {
    // Marzo-2026 es exactamente así: ₡188.000 de gasolina y ninguna fila de
    // viáticos semanales. Una lista de etiquetas «que son subtotales» habría
    // borrado ese gasto de verdad — y eso pasó en el primer intento.
    const r = csv(
      `"GASTOS SIN IVA",""\n` +
        `"INCORPORATE"," $ 100.000,00 "\n` +
        `"GASOLINA TECNICO","GASOLINA TECNICO"," $ 188.000,00 "\n` +
        `"TOTAL"," $ 288.000,00 "\n`,
    );
    expect(r.hojaGasto).toBe(288000);
    expect(r.hojaFilas).toBe(2);
  });

  test("si la gasolina NO coincide con la suma de viáticos, cuenta como gasto", () => {
    // La regla se autolimita a propósito: en cuanto los números dejan de
    // coincidir, deja de asumir que es un subtotal y el mes queda marcado para
    // que alguien lo mire.
    const r = csv(
      `"GASTOS SIN IVA",""\n` +
        `"VIATICOS TECNICO"," $ 30.000,00 "\n` +
        `"GASOLINA TECNICO","GASOLINA TECNICO"," $ 99.000,00 "\n` +
        `"TOTAL"," $ 129.000,00 "\n`,
    );
    expect(r.hojaGasto).toBe(129000);
  });

  test("un monto en una columna lejana SÍ cuenta", () => {
    // Esta prueba existe para cerrarle la puerta a un arreglo que ya se
    // intentó: cortar la búsqueda en la columna D. Descartaba «GASOLINA
    // TECNICO» por estar lejos en vez de por ser un subtotal, y con eso
    // acertaba por el motivo equivocado — hasta el día en que alguien mueva
    // una celda de columna.
    const r = csv(
      `"GASTOS SIN IVA",""\n` +
        `"UN GASTO RARO","","","","", " $ 12.000,00 "\n` +
        `"TOTAL"," $ 12.000,00 "\n`,
    );
    expect(r.hojaGasto).toBe(12000);
  });

  test("si la hoja no cuadra consigo misma, las dos cifras se conservan", () => {
    // No se corrige ni se elige una: se guardan las dos y el tablero muestra
    // la diferencia. En julio-2025 el total deja fuera la última semana.
    const r = csv(
      `"SEMANA 1"," $ 100.000,00 "\n` +
        `"SEMANA 2"," $ 40.000,00 "\n` +
        `"TOTAL"," $ 100.000,00 "\n`,
    );
    expect(r.hojaIngreso).toBe(140000);
    expect(r.totalIngreso).toBe(100000);
  });
});

/* ========================================================================== */

describe("comparar contra Convex", () => {
  const fila = (over: Record<string, unknown> = {}) => ({
    kind: "expense" as const,
    category: "otros",
    isViatico: false,
    amountCRC: 100_000,
    originalAmount: 100_000,
    originalCurrency: "CRC" as const,
    date: Date.parse("2026-05-10T10:00:00-06:00"),
    yearMonth: "2026-05",
    source: "sheet" as const,
    isDeleted: false,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  });

  const mes = (over: Record<string, unknown> = {}) => ({
    yearMonth: "2026-05",
    hojaIngreso: 0,
    hojaGasto: 100_000,
    hojaFilas: 1,
    totalIngreso: null,
    totalGasto: 100_000,
    ...over,
  });

  async function correr(
    filas: Array<Record<string, unknown>>,
    meses: Array<Record<string, unknown>>,
  ) {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      for (const f of filas) await ctx.db.insert("finance_entries", fila(f) as never);
    });
    await t.mutation(internal.bi.contraste.guardarContraste, {
      meses: meses.map((m) => mes(m)) as never,
      runAt: 1,
    });
    return t.query(internal.bi.contraste.contraste, {});
  }

  test("si cuadra, no molesta", async () => {
    const r = await correr([{}], [{}]);
    expect(r.meses[0].difGasto).toBe(0);
    expect(r.conDiferencia).toBe(0);
  });

  test("solo cuentan las filas que VIENEN de la hoja", async () => {
    // Lo capturado por la app o a mano no está en la hoja y no tiene por qué
    // cuadrar con ella. Si contara, todo agosto daría diferencia.
    const r = await correr(
      [{}, { source: "inspection", originalAmount: 999_000 }, { source: "manual", originalAmount: 555_000 }],
      [{}],
    );
    expect(r.meses[0].difGasto).toBe(0);
    expect(r.meses[0].convexFilas).toBe(1);
  });

  test("una fila dada de baja no cuenta", async () => {
    const r = await correr([{}, { isDeleted: true, originalAmount: 777_000 }], [{}]);
    expect(r.meses[0].difGasto).toBe(0);
  });

  test("una diferencia de verdad se marca", async () => {
    const r = await correr([{ originalAmount: 150_000 }], [{}]);
    expect(r.meses[0].difGasto).toBe(50_000);
    expect(r.meses[0].significativo).toBe(true);
    expect(r.conDiferencia).toBe(1);
  });

  test("los céntimos NO son una diferencia", async () => {
    // Julio-2026 arrastra ₡0,13 desde su re-importación y no significa nada.
    const r = await correr([{ originalAmount: 100_000.13 }], [{}]);
    expect(r.meses[0].significativo).toBe(false);
  });

  test("una diferencia YA EXPLICADA no vuelve a sonar", async () => {
    // Marzo-2026: la corrección que Esteban autorizó (B37). La hoja conserva
    // el valor viejo a propósito.
    const r = await correr(
      [{ yearMonth: "2026-03", originalAmount: 100_000 }],
      [{ yearMonth: "2026-03", hojaGasto: 120_004, totalGasto: 120_004 }],
    );
    expect(r.meses[0].difGasto).toBe(-20_004);
    expect(r.meses[0].significativo).toBe(false);
    expect(r.meses[0].explicacion).toContain("Esteban");
  });

  test("si el monto explicado CAMBIA, la alarma vuelve", async () => {
    // El caso que discrimina, y la razón de fijar la excepción al monto y no
    // al mes: silenciar marzo entero lo dejaría ciego para siempre.
    const r = await correr(
      [{ yearMonth: "2026-03", originalAmount: 100_000 }],
      [{ yearMonth: "2026-03", hojaGasto: 200_000, totalGasto: 200_000 }],
    );
    expect(r.meses[0].significativo).toBe(true);
    expect(r.meses[0].explicacion).toBeNull();
  });

  test("la hoja que no cuadra consigo misma se reporta APARTE", async () => {
    // Convex y las filas de la hoja coinciden; lo que falla es la celda TOTAL.
    // No es una diferencia nuestra y no se mezcla con las demás.
    const r = await correr([{}], [{ totalGasto: 80_000 }]);
    expect(r.meses[0].significativo).toBe(false);
    expect(r.hojaNoCuadra).toHaveLength(1);
    expect(r.hojaNoCuadra[0].campo).toBe("gastos");
    expect(r.hojaNoCuadra[0].diferencia).toBe(20_000);
  });
});
