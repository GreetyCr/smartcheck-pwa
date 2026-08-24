/**
 * Planilla del mes — el CÁLCULO (B28 · B29 · B30).
 *
 * Vive fuera de `convex/` a propósito: lo necesitan **las dos puntas**. El
 * servidor para guardar y la pantalla para mostrar el resultado mientras
 * Esteban escribe. Tenerlo dos veces sería la forma más fácil de que un día
 * el número de la pantalla y el que se guarda dejen de coincidir.
 *
 * Esteban escribe **tres** datos una vez al mes y el sistema deriva **seis**
 * líneas. Hoy hace esas seis cuentas a mano en su hoja, y ya nos costó una vez:
 * cuando importamos julio, las comisiones estaban en cero, después las llenó y
 * las tres provisiones se recalcularon solas — pero el sistema se había quedado
 * con la foto vieja. Eran ₡98.599 de los que faltaban.
 *
 * ---
 *
 * ## Sobre el porcentaje del aporte patronal
 *
 * Acá hay una decisión que **no tomamos nosotros**, y conviene entender por qué.
 *
 * Su hoja viene aplicando **26,92%** sobre el salario, y eso reproduce sus
 * números al colón: 430.000 × 26,92% = ₡115.756, que es exactamente lo que
 * registró en abril, mayo, junio y julio.
 *
 * Después nos mandó la tabla oficial de cargas patronales 2026, que suma
 * **28,28%** — pero incluye **2,45% de INS Riesgos del Trabajo**, y esa póliza
 * **ya la paga aparte**: son ₡8.000 al mes registrados como `POLIZA INS` en la
 * categoría `seguro`. Meter ese 2,45% en esta fórmula lo **contaría dos veces** y
 * le bajaría la utilidad sin que nada haya cambiado.
 *
 * Sacándole el INS, su tabla da **25,83%**, que tampoco es 26,92%: quedan 1,09
 * puntos sin explicar (~₡4.687 al mes).
 *
 * Por eso el valor por defecto es **26,92%: el que reproduce su realidad**.
 * Cambiarlo por iniciativa nuestra alteraría su P&L histórico basándonos en una
 * tabla que no cuadra con sus propios registros. Las tasas son **configurables**
 * justamente para que él las mueva cuando resolvamos esos 1,09 puntos.
 */


/**
 * Tasas por defecto — las que **reproducen la hoja de Esteban**, verificadas en
 * abril, mayo, junio y julio de 2026.
 *
 * *(Marzo da 31,57% / 8,50% / 3,54%. Él confirmó que fue un error de la hoja, no
 * un ajuste real, así que no se arrastra — B30.)*
 */
export const TASAS_POR_DEFECTO = {
  /** Sobre el salario bruto. NO incluye el INS: esa póliza va aparte. */
  aportePatronalPct: 26.92,
  /** Aguinaldo, preaviso y cesantía comparten tasa y base. */
  provisionPct: 8.33,
  /** Vacaciones usa OTRA base — ver abajo. */
  vacacionesPct: 3.84,
  /** Sobre la base que Esteban decide reportar, no sobre sus ingresos. */
  impuestosPct: 13,
} as const;

/**
 * La FORMA de las tasas, no los valores del default. Con `typeof
 * TASAS_POR_DEFECTO` (que va con `as const`) el tipo sería `26.92` literal, y no
 * se podría pasar ninguna otra tasa — que es justo lo contrario de lo que se
 * quiere: son configurables.
 */
export type Tasas = {
  aportePatronalPct: number;
  provisionPct: number;
  vacacionesPct: number;
  impuestosPct: number;
};

/** Las seis líneas derivadas, en el orden en que se muestran. */
export const LINEAS = [
  "aporte_patronal",
  "aguinaldo",
  "preaviso",
  "cesantia",
  "vacaciones",
  "impuestos",
] as const;

export type Linea = (typeof LINEAS)[number];

/** Etiqueta y categoría de finanzas de cada línea. */
export const META_LINEA: Record<Linea, { label: string; category: string }> = {
  aporte_patronal: { label: "Aporte patronal CCSS", category: "salario" },
  aguinaldo: { label: "Provisión aguinaldo", category: "salario" },
  preaviso: { label: "Provisión preaviso", category: "salario" },
  cesantia: { label: "Provisión cesantía", category: "salario" },
  vacaciones: { label: "Provisión vacaciones", category: "salario" },
  impuestos: { label: "Impuestos", category: "impuestos" },
};

export type EntradasPlanilla = {
  /** Salario bruto de Sergio. */
  salarioCRC: number;
  /** Comisiones del mes. */
  comisionesCRC: number;
  /** La base que Esteban decide reportar — la elige él, no la deducimos. */
  baseImponibleCRC: number;
};

export type LineaCalculada = {
  linea: Linea;
  label: string;
  category: string;
  amountCRC: number;
  /** Cómo salió, en palabras. Se muestra en pantalla para que sea auditable. */
  formula: string;
};

/** Colones enteros: es la unidad en la que se registra todo (RF). */
function aColones(n: number): number {
  return Math.round(n);
}

/**
 * Las seis líneas, a partir de los tres datos.
 *
 * Pura y exportada: es la única regla del cálculo y se prueba sin base de datos,
 * contra los números reales de julio.
 *
 * **Ojo con la base de vacaciones**, que es el detalle fácil de perder: las
 * otras tres provisiones se calculan sobre *(salario + comisiones)*, pero
 * vacaciones va sobre *(salario + aporte patronal)* — no lleva comisiones y sí
 * suma la carga. Es exactamente el tipo de cosa que conviene que haga el sistema
 * y no una persona a las once de la noche.
 */
export function calcularPlanilla(
  { salarioCRC, comisionesCRC, baseImponibleCRC }: EntradasPlanilla,
  tasas: Tasas = TASAS_POR_DEFECTO,
): LineaCalculada[] {
  const aportePatronal = aColones(salarioCRC * (tasas.aportePatronalPct / 100));
  const baseProvisiones = salarioCRC + comisionesCRC;
  const provision = aColones(baseProvisiones * (tasas.provisionPct / 100));
  const vacaciones = aColones(
    (salarioCRC + aportePatronal) * (tasas.vacacionesPct / 100),
  );
  const impuestos = aColones(baseImponibleCRC * (tasas.impuestosPct / 100));

  const f = (n: number) => n.toString().replace(".", ",");

  return [
    {
      linea: "aporte_patronal",
      ...META_LINEA.aporte_patronal,
      amountCRC: aportePatronal,
      formula: `${f(tasas.aportePatronalPct)}% × salario`,
    },
    {
      linea: "aguinaldo",
      ...META_LINEA.aguinaldo,
      amountCRC: provision,
      formula: `${f(tasas.provisionPct)}% × (salario + comisiones)`,
    },
    {
      linea: "preaviso",
      ...META_LINEA.preaviso,
      amountCRC: provision,
      formula: `${f(tasas.provisionPct)}% × (salario + comisiones)`,
    },
    {
      linea: "cesantia",
      ...META_LINEA.cesantia,
      amountCRC: provision,
      formula: `${f(tasas.provisionPct)}% × (salario + comisiones)`,
    },
    {
      linea: "vacaciones",
      ...META_LINEA.vacaciones,
      amountCRC: vacaciones,
      formula: `${f(tasas.vacacionesPct)}% × (salario + aporte patronal)`,
    },
    {
      linea: "impuestos",
      ...META_LINEA.impuestos,
      amountCRC: impuestos,
      formula: `${f(tasas.impuestosPct)}% × base a reportar`,
    },
  ];
}

/**
 * Llave de idempotencia de cada línea.
 *
 * Mismo patrón que F5-auto: re-registrar el mismo mes **actualiza** las seis
 * filas en vez de duplicarlas. Es lo que hace seguro corregir el salario y
 * volver a confirmar.
 */
export function llaveDeLinea(yearMonth: string, linea: Linea): string {
  return `planilla:${yearMonth}:${linea}`;
}

