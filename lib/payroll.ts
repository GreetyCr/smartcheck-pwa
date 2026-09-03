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
 * **La tasa cambia con el tiempo, así que no es una constante: es una tabla de
 * vigencias.** Esteban lo confirmó el 24-ago (B36):
 *
 * | Vigencia | Aporte patronal | Composición |
 * |---|---|---|
 * | abril–julio 2026 | **26,92%** | 25,83% de CCSS + **1,09%** |
 * | agosto 2026 en adelante | **28,28%** | 25,83% de CCSS + **2,45% de INS** |
 *
 * Los 26,92% reproducen su hoja al colón —430.000 × 26,92% = ₡115.756, sus
 * números exactos de abril a julio— y los 28,28% son su tabla oficial completa.
 *
 * **Y ahí se explica solo el misterio del 1,09%.** Estuvimos semanas preguntando
 * de dónde salía ese punto y pico que sobraba sobre el 25,83% de la CCSS. La
 * respuesta es que **ocupaba exactamente el lugar del INS**: al pasar a 28,28% se
 * reemplazó por el 2,45% real. Era una tasa de INS vieja o incompleta, y se
 * corrigió sola. No hacía falta buscarla en ningún lado.
 *
 * ## Por qué importa `incluyeINS`
 *
 * Hasta julio, la póliza del INS iba **aparte**: ₡8.000/mes como `POLIZA INS` en
 * la categoría `seguro`. Desde agosto va **adentro** del 28,28% — verificado
 * contra PROD: agosto **no tiene** esa línea.
 *
 * Si algún mes tuviera las dos cosas, el INS se contaría **dos veces**. Por eso
 * cada vigencia declara si su tasa ya lo trae adentro, y la pantalla avisa cuando
 * detecta el choque. No lo bloquea: la póliza es dato suyo y puede cubrir otra
 * cosa; lo que no puede es pasar inadvertido.
 */


/**
 * La FORMA de las tasas. Se declara antes que las vigencias porque las tipa.
 */
export type Tasas = {
  aportePatronalPct: number;
  provisionPct: number;
  vacacionesPct: number;
  impuestosPct: number;
};

export type Vigencia = {
  /** Primer mes en que aplica, `AAAA-MM`. Aplica hasta que empiece la siguiente. */
  desde: string;
  tasas: Tasas;
  /** ¿El aporte patronal ya trae adentro el 2,45% del INS Riesgos del Trabajo? */
  incluyeINS: boolean;
  /** De dónde sale la tasa, para que el número no haya que creerlo a ciegas. */
  nota: string;
};

/**
 * Las vigencias, **de la más vieja a la más nueva**. `vigenciaDelMes` recorre de
 * atrás hacia adelante y toma la primera que ya empezó, así que agregar una
 * vigencia futura es añadir una fila acá y nada más.
 */
export const VIGENCIAS: readonly Vigencia[] = [
  {
    desde: "2026-04",
    tasas: {
      aportePatronalPct: 26.92,
      provisionPct: 8.33,
      vacacionesPct: 3.84,
      impuestosPct: 13,
    },
    incluyeINS: false,
    nota: "25,83% de la CCSS + 1,09%. Ese 1,09% ocupaba el lugar del INS y resultó ser una tasa vieja. La póliza se pagaba aparte (₡8.000/mes en «seguro»). Verificado en abril, mayo, junio y julio de 2026.",
  },
  {
    desde: "2026-08",
    tasas: {
      aportePatronalPct: 28.28,
      provisionPct: 8.33,
      vacacionesPct: 3.84,
      impuestosPct: 13,
    },
    incluyeINS: true,
    nota: "25,83% de la CCSS + 2,45% de INS Riesgos del Trabajo. Desde agosto el INS va DENTRO de la planilla y ya no se anota como póliza aparte.",
  },
] as const;

/**
 * La vigencia que aplica a un mes.
 *
 * Para un mes anterior a la primera vigencia devuelve **la primera**, no un
 * error: los meses viejos (marzo hacia atrás) están bloqueados por otra vía
 * (B34) y no vale la pena reventar acá una pantalla por un mes que igual no se
 * puede registrar.
 */
export function vigenciaDelMes(yearMonth: string): Vigencia {
  for (let i = VIGENCIAS.length - 1; i >= 0; i--) {
    if (yearMonth >= VIGENCIAS[i].desde) return VIGENCIAS[i];
  }
  return VIGENCIAS[0];
}

/** Atajo: solo las tasas de ese mes. */
export function tasasDelMes(yearMonth: string): Tasas {
  return vigenciaDelMes(yearMonth).tasas;
}

/**
 * Tasas por defecto **de la vigencia más nueva**.
 *
 * Se conserva por compatibilidad, pero casi siempre lo correcto es
 * `tasasDelMes(mes)`: usar esta constante para un mes viejo le aplicaría la tasa
 * de hoy y le movería el histórico.
 */
export const TASAS_POR_DEFECTO: Tasas = VIGENCIAS[VIGENCIAS.length - 1].tasas;

/** Las seis líneas derivadas, en el orden en que se muestran. */
export const LINEAS = [
  /**
   * **Los dos pagos, primero — A123.**
   *
   * Hasta el 2-set la planilla derivaba seis líneas (cargas y provisiones) pero
   * **no registraba lo que se paga**: el salario y las comisiones eran solo
   * insumos del cálculo. Esteban tecleó el salario de Sergio acá, dio por hecho
   * que quedaba anotado —que es lo razonable: se lo pidió esta pantalla— y en
   * agosto quedaron **₡485.600 de gasto sin registrar**, con la utilidad
   * sobrestimada por ese monto. El aporte patronal se calculaba sobre un salario
   * que no existía en ninguna otra parte del sistema.
   *
   * Van **primero** en la lista porque son el pago; lo demás se deriva de ellos.
   */
  "salario",
  "comisiones",
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
  salario: { label: "Salario", category: "salario" },
  comisiones: { label: "Comisiones", category: "comision" },
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
 * Las líneas de la planilla, a partir de los tres datos: **los dos pagos**
 * (salario y comisiones) y **las seis derivadas** (cargas y provisiones).
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

  /* Un cero no se registra: una fila de ₡0 en Finanzas es ruido que hay que
     explicar cada vez que alguien la ve. Si un mes no hubo comisiones, la línea
     simplemente no existe. */
  const pagos: LineaCalculada[] = [];
  if (salarioCRC > 0) {
    pagos.push({
      linea: "salario",
      ...META_LINEA.salario,
      amountCRC: aColones(salarioCRC),
      formula: "lo que se paga de salario en el mes",
    });
  }
  if (comisionesCRC > 0) {
    pagos.push({
      linea: "comisiones",
      ...META_LINEA.comisiones,
      amountCRC: aColones(comisionesCRC),
      formula: "lo que se paga de comisiones en el mes",
    });
  }

  return [
    ...pagos,
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
 * Mismo patrón que F5-auto: re-registrar el mismo mes **actualiza** sus filas
 * en vez de duplicarlas. Es lo que hace seguro corregir el salario y
 * volver a confirmar.
 */
export function llaveDeLinea(yearMonth: string, linea: Linea): string {
  return `planilla:${yearMonth}:${linea}`;
}

