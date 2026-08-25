/**
 * Cálculo de la planilla del mes (B28 · B29 · B30).
 *
 * La prueba que manda es la primera: **reproducir julio de 2026 al colón**.
 * Las tasas se sacaron de la hoja de Esteban y se verificaron en cuatro meses;
 * si el cálculo no da sus números exactos, es que entendimos mal la fórmula, y
 * un error acá le mueve la utilidad todos los meses.
 */
import { describe, expect, test } from "vitest";
import {
  TASAS_POR_DEFECTO,
  VIGENCIAS,
  calcularPlanilla,
  llaveDeLinea,
  tasasDelMes,
  vigenciaDelMes,
} from "../../lib/payroll";

/**
 * Las tasas de julio. **No se usa `TASAS_POR_DEFECTO`**: desde agosto el default
 * es 28,28%, y pedirle a la constante global que reproduzca un mes viejo es
 * exactamente el error que la tabla de vigencias existe para evitar.
 */
const TASAS_JULIO = tasasDelMes("2026-07");

/** Julio de 2026, tal como quedó registrado en producción. */
const JULIO = {
  salarioCRC: 430_000,
  comisionesCRC: 73_000,
  baseImponibleCRC: 1_000_000,
};

const monto = (lineas: ReturnType<typeof calcularPlanilla>, linea: string) =>
  lineas.find((l) => l.linea === linea)!.amountCRC;

describe("reproduce julio de 2026 al colón", () => {
  const lineas = calcularPlanilla(JULIO, TASAS_JULIO);

  test("aporte patronal CCSS = ₡115.756", () => {
    // 430.000 × 26,92%. Es el número que Esteban tiene registrado en abril,
    // mayo, junio y julio — verificado contra PROD.
    expect(monto(lineas, "aporte_patronal")).toBe(115_756);
  });

  test("las tres provisiones de 8,33% dan ₡41.900 cada una", () => {
    // (430.000 + 73.000) × 8,33%. Llevan comisiones; vacaciones no.
    for (const l of ["aguinaldo", "preaviso", "cesantia"]) {
      expect(monto(lineas, l), l).toBe(41_900);
    }
  });

  test("vacaciones = ₡20.957 — usa OTRA base", () => {
    // (430.000 + 115.756) × 3,84%: sin comisiones, con el aporte patronal.
    // Es el detalle que más fácil se pierde haciéndolo a mano.
    expect(monto(lineas, "vacaciones")).toBe(20_957);
  });

  test("impuestos = ₡130.000", () => {
    expect(monto(lineas, "impuestos")).toBe(130_000);
  });

  test("son seis líneas, ni una más", () => {
    expect(lineas).toHaveLength(6);
  });
});

describe("la base de vacaciones no se confunde con la de las otras", () => {
  test("subir las comisiones NO mueve vacaciones", () => {
    // Si vacaciones usara (salario + comisiones), esto la movería. Es la
    // prueba que separa las dos bases.
    const base = calcularPlanilla(JULIO, TASAS_JULIO);
    const conMasComisiones = calcularPlanilla({ ...JULIO, comisionesCRC: 200_000 }, TASAS_JULIO);

    expect(monto(conMasComisiones, "aguinaldo")).toBeGreaterThan(monto(base, "aguinaldo"));
    expect(monto(conMasComisiones, "vacaciones")).toBe(monto(base, "vacaciones"));
  });

  test("subir el salario mueve TODO menos impuestos", () => {
    const base = calcularPlanilla(JULIO, TASAS_JULIO);
    const conMasSalario = calcularPlanilla({ ...JULIO, salarioCRC: 500_000 }, TASAS_JULIO);

    for (const l of ["aporte_patronal", "aguinaldo", "preaviso", "cesantia", "vacaciones"]) {
      expect(monto(conMasSalario, l), l).toBeGreaterThan(monto(base, l));
    }
    // Los impuestos salen de la base que Esteban declara, no del salario.
    expect(monto(conMasSalario, "impuestos")).toBe(monto(base, "impuestos"));
  });
});

describe("las tasas son configurables", () => {
  test("cada mes toma la tasa de SU vigencia, no la de hoy", () => {
    // Es la regla entera en dos líneas. Si `tasasDelMes` devolviera siempre la
    // más nueva, registrar un mes viejo le movería el histórico a Esteban.
    expect(tasasDelMes("2026-07").aportePatronalPct).toBe(26.92);
    expect(tasasDelMes("2026-08").aportePatronalPct).toBe(28.28);
    expect(tasasDelMes("2026-12").aportePatronalPct).toBe(28.28);
  });

  test("el 1,09% y el 2,45% del INS ocupan el mismo lugar", () => {
    // Los 25,83% de la CCSS son el piso común de las dos vigencias. Lo que
    // cambió en agosto fue el sobrante: 1,09 (una tasa vieja de INS) pasó a
    // 2,45 (el INS real). Esta prueba deja escrita esa explicación.
    const CCSS = 25.83;
    expect(tasasDelMes("2026-07").aportePatronalPct - CCSS).toBeCloseTo(1.09, 2);
    expect(tasasDelMes("2026-08").aportePatronalPct - CCSS).toBeCloseTo(2.45, 2);
  });

  test("solo la vigencia nueva declara que la tasa ya trae el INS", () => {
    // De esto depende el aviso de doble conteo: hasta julio la póliza iba
    // aparte (₡8.000/mes en «seguro») y desde agosto va adentro.
    expect(vigenciaDelMes("2026-07").incluyeINS).toBe(false);
    expect(vigenciaDelMes("2026-08").incluyeINS).toBe(true);
  });

  test("un mes anterior a la primera vigencia no revienta", () => {
    // Marzo y antes están bloqueados por otra vía (B34); acá basta con que
    // devuelva algo coherente en vez de undefined.
    expect(vigenciaDelMes("2025-01")).toBe(VIGENCIAS[0]);
  });

  test("las vigencias están ordenadas de vieja a nueva", () => {
    // `vigenciaDelMes` recorre de atrás hacia adelante y depende de ese orden.
    const desdes = VIGENCIAS.map((v) => v.desde);
    expect([...desdes].sort()).toEqual(desdes);
    expect(TASAS_POR_DEFECTO).toBe(VIGENCIAS[VIGENCIAS.length - 1].tasas);
  });

  test("cambiar una tasa cambia solo su línea", () => {
    const lineas = calcularPlanilla(JULIO, {
      ...TASAS_JULIO,
      impuestosPct: 10,
    });
    expect(monto(lineas, "impuestos")).toBe(100_000);
    expect(monto(lineas, "aporte_patronal")).toBe(115_756); // intacta
  });

  test("con las tasas de marzo da los números de marzo", () => {
    // Marzo fue un error de la hoja (B30) y NO se arrastra, pero el cálculo
    // tiene que poder reproducirlo: si mañana hay que auditarlo, se hace
    // cambiando tasas, no tocando código.
    const marzo = calcularPlanilla(
      { salarioCRC: 430_000, comisionesCRC: 0, baseImponibleCRC: 0 },
      { ...TASAS_JULIO, aportePatronalPct: 31.57 },
    );
    expect(monto(marzo, "aporte_patronal")).toBe(135_751);
  });
});

describe("bordes", () => {
  test("sin comisiones las provisiones salen solo del salario", () => {
    const lineas = calcularPlanilla({ ...JULIO, comisionesCRC: 0 }, TASAS_JULIO);
    expect(monto(lineas, "aguinaldo")).toBe(Math.round(430_000 * 0.0833));
  });

  test("en ceros no explota ni deja NaN", () => {
    const lineas = calcularPlanilla({
      salarioCRC: 0, comisionesCRC: 0, baseImponibleCRC: 0,
    });
    for (const l of lineas) {
      expect(Number.isFinite(l.amountCRC), l.linea).toBe(true);
      expect(l.amountCRC).toBe(0);
    }
  });

  test("todo sale en colones enteros", () => {
    // Nada de decimales sueltos: es la unidad en la que se registra todo.
    const lineas = calcularPlanilla({
      salarioCRC: 437_777, comisionesCRC: 3_333, baseImponibleCRC: 999_999,
    });
    for (const l of lineas) {
      expect(Number.isInteger(l.amountCRC), `${l.linea} = ${l.amountCRC}`).toBe(true);
    }
  });

  test("cada línea dice cómo se calculó", () => {
    // La fórmula se muestra en pantalla: si el número sorprende, el porqué
    // está al lado y no hay que preguntarle a nadie.
    for (const l of calcularPlanilla(JULIO, TASAS_JULIO)) {
      expect(l.formula.length, l.linea).toBeGreaterThan(0);
      expect(l.label.length, l.linea).toBeGreaterThan(0);
    }
    expect(calcularPlanilla(JULIO, TASAS_JULIO)[4].formula).toContain("aporte patronal");
  });
});

describe("idempotencia", () => {
  test("la llave es estable y distinta por mes y por línea", () => {
    expect(llaveDeLinea("2026-07", "aguinaldo")).toBe("planilla:2026-07:aguinaldo");
    expect(llaveDeLinea("2026-07", "aguinaldo")).toBe(llaveDeLinea("2026-07", "aguinaldo"));
    expect(llaveDeLinea("2026-08", "aguinaldo")).not.toBe(llaveDeLinea("2026-07", "aguinaldo"));
    expect(llaveDeLinea("2026-07", "preaviso")).not.toBe(llaveDeLinea("2026-07", "cesantia"));
  });

  test("aguinaldo, preaviso y cesantía valen igual pero NO comparten llave", () => {
    // Dan el mismo monto; si compartieran llave, tres líneas se volverían una
    // y el gasto de planilla se subestimaría en dos tercios.
    const lineas = calcularPlanilla(JULIO, TASAS_JULIO);
    expect(monto(lineas, "aguinaldo")).toBe(monto(lineas, "cesantia"));
    const llaves = new Set(lineas.map((l) => llaveDeLinea("2026-07", l.linea)));
    expect(llaves.size).toBe(6);
  });
});
