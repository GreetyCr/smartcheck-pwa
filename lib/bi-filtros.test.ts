/**
 * Estado de la barra de filtros global (RF-02).
 *
 * Lo que se fija acá es **el recorte**, que es donde esta barra puede mentir:
 * si a una pantalla se le mandara una dimensión que su query ignora, la barra
 * diría «Heredia» y los números serían de todo el país. Es literalmente A64, y
 * es la razón por la que cada pantalla declara qué honra.
 */
import { describe, expect, test } from "vitest";
import {
  argsDeFiltros,
  contarActivos,
  escribirFiltros,
  leerFiltros,
  rangoDelFiltro,
} from "@/lib/bi-filtros";

const AHORA = Date.parse("2026-08-25T10:00:00-06:00");

describe("ida y vuelta con la URL", () => {
  test("lo que se escribe se vuelve a leer igual", () => {
    const f = {
      periodo: "6m" as const,
      brand: "Hyundai",
      province: "Heredia",
      currency: "USD",
    };
    expect(leerFiltros(escribirFiltros(f))).toEqual(f);
  });

  test("el valor neutro NO ensucia la URL", () => {
    // Con «Todo» y sin dimensiones, el enlace tiene que quedar limpio: si cada
    // visita agregara `?p=todo`, compartir la portada mandaría un enlace con
    // parámetros que no dicen nada.
    expect(escribirFiltros({ periodo: "todo" }).toString()).toBe("");
  });

  test("un periodo inventado en la URL cae en «todo» y no rompe", () => {
    const sp = new URLSearchParams("p=hace_rato&marca=Toyota");
    expect(leerFiltros(sp)).toEqual({ periodo: "todo", brand: "Toyota" });
  });

  test("sin parámetros, el estado es el neutro", () => {
    expect(leerFiltros(null)).toEqual({ periodo: "todo" });
    expect(leerFiltros(new URLSearchParams())).toEqual({ periodo: "todo" });
  });
});

describe("el recorte por pantalla", () => {
  test("NO se manda una dimensión que la pantalla no honra", () => {
    // El caso que discrimina, y el motivo de que exista `soporta`: Finanzas
    // solo entiende de periodo, así que la marca no puede viajar en la query.
    const args = argsDeFiltros(
      { periodo: "3m", brand: "Hyundai", province: "Heredia" },
      ["periodo"],
      AHORA,
    );
    expect(args.brand).toBeUndefined();
    expect(args.province).toBeUndefined();
    expect(args.fromMs).toBeDefined();
  });

  test("tampoco se manda el periodo si la pantalla no lo honra", () => {
    // La portada tiene su propio selector de periodo: mandarle también el de
    // la barra dejaría dos controles del mismo eje peleando.
    const args = argsDeFiltros({ periodo: "3m", brand: "Hyundai" }, ["brand"], AHORA);
    expect(args.fromMs).toBeUndefined();
    expect(args.brand).toBe("Hyundai");
  });

  test("«todo» no manda rango, ni siquiera uno abierto", () => {
    const args = argsDeFiltros({ periodo: "todo" }, ["periodo"], AHORA);
    expect(args).toEqual({});
  });
});

describe("el rango del periodo", () => {
  test("se alinea al inicio del mes y no a «hace 90 días»", () => {
    // Sin alinear, el mes más viejo entra partido y su caída se lee como una
    // caída del negocio cuando lo único que pasa es que faltan días.
    const { fromMs } = rangoDelFiltro("3m", AHORA);
    const d = new Date(fromMs!);
    expect(d.getUTCDate()).toBe(1);
    // 3 meses contando el actual: junio, julio, agosto.
    expect(d.getUTCMonth()).toBe(5);
    expect(d.getUTCFullYear()).toBe(2026);
  });

  test("«este mes» arranca el día 1 del mes en curso", () => {
    const { fromMs } = rangoDelFiltro("1m", AHORA);
    const d = new Date(fromMs!);
    expect(d.getUTCMonth()).toBe(7); // agosto
    expect(d.getUTCDate()).toBe(1);
  });

  test("«todo» no tiene borde inferior", () => {
    expect(rangoDelFiltro("todo", AHORA)).toEqual({});
  });
});

describe("la cuenta de filtros puestos", () => {
  test("«todo» no cuenta como filtro", () => {
    expect(contarActivos({ periodo: "todo" })).toBe(0);
    expect(contarActivos({ periodo: "6m" })).toBe(1);
    expect(contarActivos({ periodo: "6m", brand: "Kia", currency: "USD" })).toBe(3);
  });
});
