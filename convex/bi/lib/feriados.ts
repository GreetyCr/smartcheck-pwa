/**
 * Feriados de Costa Rica — **RF-20 · RF-21 · RF-22** (A117).
 *
 * ## Por qué es una tabla escrita a mano y no una regla que los calcule
 *
 * Tres razones, y las tres se comprobaron antes de escribir esto:
 *
 *  1. **Jueves y Viernes Santo se mueven cada año** (dependen de la Pascua). Una
 *     regla exige implementar el cómputo de la Pascua, que es más código y más
 *     riesgo que doce líneas por año.
 *  2. **La lista cambia por ley, no por calendario.** El **12 de octubre dejó de
 *     ser feriado** con la Ley 9803 (vigente desde 2020) y en su lugar entró el
 *     **1.º de diciembre**; el **31 de agosto** se agregó después. Cualquier
 *     regla «histórica» habría heredado el 12 de octubre — de hecho todavía hay
 *     páginas que lo listan.
 *  3. **El traslado a lunes puede volver.** La reforma que movía feriados al
 *     lunes por el turismo **caducó en 2024**, así que 2025, 2026 y 2027 se
 *     conmemoran en su fecha exacta; pero hay un proyecto en la Asamblea para
 *     reinstaurarlo. Con fechas explícitas por año, un traslado es **un dato que
 *     se corrige**; con una regla, sería un error silencioso en planilla.
 *
 * ## Fuente y fecha de verificación
 *
 * Verificado el **1-set-2026** contra BDO Costa Rica («Feriados 2026 en Costa
 * Rica: calendario oficial y consideraciones laborales») y la prensa económica
 * (El Financiero, La República), que coinciden en **9 de pago obligatorio y 3 de
 * pago no obligatorio, sin traslados**. El MTSS publica el calendario oficial en
 * `mtss.go.cr/temas-laborales/feriados/` (su PDF bloquea la descarga automática,
 * así que se contrastó contra las otras dos).
 *
 * ## Qué significa cada tipo (Código de Trabajo, arts. 148 y 152)
 *
 *  - **Pago obligatorio**: se paga aunque no se trabaje. Si **se trabaja**, se
 *    debe pagar **doble**. Es el que importa para planilla.
 *  - **Pago no obligatorio**: si no se trabaja, no se paga; si se trabaja, se
 *    paga sencillo salvo acuerdo.
 *
 * **Al agregar un año nuevo**: verificar la lista contra el MTSS de ese año, no
 * copiar el anterior — y actualizar `ULTIMA_VERIFICACION`.
 */

export type TipoFeriado = "obligatorio" | "no_obligatorio";

export type Feriado = {
  /** "YYYY-MM-DD" en zona CR. */
  fecha: string;
  nombre: string;
  tipo: TipoFeriado;
};

/** Cuándo se contrastó esta lista contra la fuente. Se muestra en pantalla. */
export const ULTIMA_VERIFICACION = "2026-09-01";

/**
 * Feriados por año. **Fechas explícitas a propósito** (ver la nota de arriba).
 *
 * Los nueve de pago obligatorio son los mismos todos los años salvo Semana
 * Santa; los tres de pago no obligatorio son 2 y 31 de agosto y 1.º de
 * diciembre. Ninguno se traslada en 2025–2027.
 */
export const FERIADOS: Record<number, Feriado[]> = {
  2025: [
    { fecha: "2025-01-01", nombre: "Año Nuevo", tipo: "obligatorio" },
    { fecha: "2025-04-11", nombre: "Batalla de Rivas (Juan Santamaría)", tipo: "obligatorio" },
    { fecha: "2025-04-17", nombre: "Jueves Santo", tipo: "obligatorio" },
    { fecha: "2025-04-18", nombre: "Viernes Santo", tipo: "obligatorio" },
    { fecha: "2025-05-01", nombre: "Día Internacional del Trabajo", tipo: "obligatorio" },
    { fecha: "2025-07-25", nombre: "Anexión del Partido de Nicoya", tipo: "obligatorio" },
    { fecha: "2025-08-02", nombre: "Virgen de los Ángeles", tipo: "no_obligatorio" },
    { fecha: "2025-08-15", nombre: "Día de la Madre", tipo: "obligatorio" },
    { fecha: "2025-08-31", nombre: "Día de la Persona Negra y la Cultura Afrocostarricense", tipo: "no_obligatorio" },
    { fecha: "2025-09-15", nombre: "Independencia", tipo: "obligatorio" },
    { fecha: "2025-12-01", nombre: "Abolición del Ejército", tipo: "no_obligatorio" },
    { fecha: "2025-12-25", nombre: "Navidad", tipo: "obligatorio" },
  ],
  2026: [
    { fecha: "2026-01-01", nombre: "Año Nuevo", tipo: "obligatorio" },
    { fecha: "2026-04-02", nombre: "Jueves Santo", tipo: "obligatorio" },
    { fecha: "2026-04-03", nombre: "Viernes Santo", tipo: "obligatorio" },
    { fecha: "2026-04-11", nombre: "Batalla de Rivas (Juan Santamaría)", tipo: "obligatorio" },
    { fecha: "2026-05-01", nombre: "Día Internacional del Trabajo", tipo: "obligatorio" },
    { fecha: "2026-07-25", nombre: "Anexión del Partido de Nicoya", tipo: "obligatorio" },
    { fecha: "2026-08-02", nombre: "Virgen de los Ángeles", tipo: "no_obligatorio" },
    { fecha: "2026-08-15", nombre: "Día de la Madre", tipo: "obligatorio" },
    { fecha: "2026-08-31", nombre: "Día de la Persona Negra y la Cultura Afrocostarricense", tipo: "no_obligatorio" },
    { fecha: "2026-09-15", nombre: "Independencia", tipo: "obligatorio" },
    { fecha: "2026-12-01", nombre: "Abolición del Ejército", tipo: "no_obligatorio" },
    { fecha: "2026-12-25", nombre: "Navidad", tipo: "obligatorio" },
  ],
  2027: [
    { fecha: "2027-01-01", nombre: "Año Nuevo", tipo: "obligatorio" },
    { fecha: "2027-03-25", nombre: "Jueves Santo", tipo: "obligatorio" },
    { fecha: "2027-03-26", nombre: "Viernes Santo", tipo: "obligatorio" },
    { fecha: "2027-04-11", nombre: "Batalla de Rivas (Juan Santamaría)", tipo: "obligatorio" },
    { fecha: "2027-05-01", nombre: "Día Internacional del Trabajo", tipo: "obligatorio" },
    { fecha: "2027-07-25", nombre: "Anexión del Partido de Nicoya", tipo: "obligatorio" },
    { fecha: "2027-08-02", nombre: "Virgen de los Ángeles", tipo: "no_obligatorio" },
    { fecha: "2027-08-15", nombre: "Día de la Madre", tipo: "obligatorio" },
    { fecha: "2027-08-31", nombre: "Día de la Persona Negra y la Cultura Afrocostarricense", tipo: "no_obligatorio" },
    { fecha: "2027-09-15", nombre: "Independencia", tipo: "obligatorio" },
    { fecha: "2027-12-01", nombre: "Abolición del Ejército", tipo: "no_obligatorio" },
    { fecha: "2027-12-25", nombre: "Navidad", tipo: "obligatorio" },
  ],
};

/** Los años que la tabla cubre, ordenados. */
export const ANIOS_CUBIERTOS = Object.keys(FERIADOS)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Índice fecha → feriado, para preguntar por un día sin recorrer la lista.
 * Se arma una vez: el módulo es constante.
 */
const POR_FECHA: Map<string, Feriado> = new Map(
  ANIOS_CUBIERTOS.flatMap((a) => FERIADOS[a]).map((f) => [f.fecha, f]),
);

/** El feriado de ese día (`"YYYY-MM-DD"` en zona CR), o `null`. */
export function feriadoDe(isoDia: string): Feriado | null {
  return POR_FECHA.get(isoDia) ?? null;
}

/**
 * ¿La tabla cubre ese año?
 *
 * Existe para que la pantalla pueda **decir que no sabe** en vez de mostrar un
 * calendario vacío. Un año sin datos se ve idéntico a un año sin feriados, y esa
 * confusión es exactamente la que la regla del hueco ruidoso prohíbe (A64/A88):
 * en enero de 2028, sin esto, el panel diría en silencio que no hay feriados.
 */
export function anioCubierto(anio: number): boolean {
  return anio in FERIADOS;
}

/** Los feriados de un año, o lista vacía si no está cubierto (ver `anioCubierto`). */
export function feriadosDelAnio(anio: number): Feriado[] {
  return FERIADOS[anio] ?? [];
}
