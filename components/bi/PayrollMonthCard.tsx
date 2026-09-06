"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import {
  formatCRC,
  formatDateCR,
  formatIsoDateCR,
  formatMonthLong,
  toDateInputValue,
} from "@/lib/bi-format";
import { TASAS_POR_DEFECTO, calcularPlanilla, type Tasas } from "@/lib/payroll";
import { cn } from "@/lib/utils";

/** `"2026-07"` del mes en curso, en zona CR. */
function mesActual(): string {
  return toDateInputValue(Date.now()).slice(0, 7);
}

/** «línea» o «líneas» según toque: el mensaje decía «1 líneas». */
const lineas = (n: number) => `${n} ${n === 1 ? "línea" : "líneas"}`;

/**
 * Qué pasó al guardar, con las dos mitades — A151.
 *
 * Se separa del componente para poder probarlo: es la única lógica del archivo
 * que se puede equivocar en silencio, porque un mensaje mal armado no rompe
 * nada y nadie lo mira dos veces.
 */
export function resumen(creadas: number, actualizadas: number): string {
  if (creadas > 0 && actualizadas > 0) {
    return `Listo: ${lineas(creadas)} nuevas en Finanzas y ${actualizadas} corregidas.`;
  }
  if (creadas > 0) return `Listo: ${lineas(creadas)} entraron a Finanzas.`;
  if (actualizadas > 0) {
    return `Listo: se corrigieron ${lineas(actualizadas)} del mes; ninguna nueva.`;
  }
  return "Listo: no hubo nada que cambiar, el mes ya estaba así.";
}

/**
 * Planilla del mes — los gastos que se calculan solos (B28).
 *
 * Esteban escribe **cuatro** datos —salario, comisiones, base a reportar y días de
 * feriado trabajados— y el sistema deriva el resto: **ocho líneas**, o nueve en
 * un mes con feriado. Hoy hace
 * esas cuentas a mano en su hoja, y el error más caro que tuvimos —₡98.599 de
 * julio— salió justo de ahí: llenó las comisiones después, la hoja recalculó
 * sola y el sistema se quedó con la foto vieja.
 *
 * Dos decisiones de esta pantalla:
 *
 * 1. **El cálculo se ve ANTES de confirmar.** No es un botón que hace algo
 *    invisible: las líneas y su fórmula están en pantalla mientras escribe.
 *    Si un número lo sorprende, el porqué está al lado.
 * 2. **Confirmar el mismo mes corrige, no duplica.** Por eso el botón cambia a
 *    «Actualizar» cuando el mes ya está registrado, y se dice explícitamente que
 *    se recalculan. Sin eso, la duda razonable es «¿lo voy a meter dos
 *    veces?» — y la respuesta importa, porque duplicar planilla es un error que
 *    se ve razonable en el tablero.
 *
 * Los datos entran por props y no con `useQuery` adentro, igual que el resto del
 * tablero. No es solo consistencia: **si la sesión se vence con la pantalla
 * abierta, una query que lanza dentro del componente tumba todo y se pierde lo
 * que Esteban estaba escribiendo.** Acá lo peor que pasa es que no se cargue lo
 * guardado; el formulario sigue en pie.
 */
export type PlanillaGuardada = {
  yearMonth: string;
  insumos: {
    salarioCRC: number;
    comisionesCRC: number;
    baseImponibleCRC: number;
    /** `null` = el mes se registró antes de que la planilla mirara feriados. */
    feriadosDias: number | null;
    tasas: Tasas;
    updatedAt: number;
  } | null;
  /** Feriados obligatorios que el sistema detectó trabajados (A129). */
  feriadosDetectados: {
    dias: number;
    detalle: Array<{
      fecha: string;
      nombre: string;
      tipo: "obligatorio" | "no_obligatorio";
      tecnico: string;
      revisiones: number;
    }>;
  };
  tasasPorDefecto: Tasas;
  /** Líneas que el mes ya trae desde la hoja o capturadas a mano (B34). */
  lineasYaCargadas: Array<{ etiqueta: string; amountCRC: number; source: string }>;
  /** Qué vigencia de tasas rige este mes y de dónde sale (B36). */
  vigencia: { desde: string; incluyeINS: boolean; nota: string };
  /** Póliza del INS suelta en un mes cuya tasa ya la incluye (B36). */
  avisoPolizaINS: { etiqueta: string; amountCRC: number } | null;
};

export function PayrollMonthCard({
  mes,
  onMes,
  guardado,
  onRegistrar,
  onListoParaSugerencias,
}: {
  mes: string;
  onMes: (ym: string) => void;
  /** `undefined` mientras carga; `null` si no se pudo leer. */
  guardado: PlanillaGuardada | null | undefined;
  onRegistrar: (input: {
    yearMonth: string;
    salarioCRC: number;
    comisionesCRC: number;
    baseImponibleCRC: number;
    feriadosDias: number;
  }) => Promise<{ creadas: number; actualizadas: number }>;
  /**
   * Le entrega al padre la forma de escribir en el campo de comisiones, para
   * que la tarjeta de pagos del técnico pueda pasarle su número.
   *
   * Va así, y no al revés (una prop `comisionSugerida` que se autocompletara),
   * porque **rellenar solo un campo que Esteban ya llenó sería pisarle el dato
   * sin preguntar**. Con esto, el valor entra solo cuando él pulsa.
   */
  onListoParaSugerencias?: (aplicar: (montoCRC: number) => void) => void;
}) {

  const [salario, setSalario] = useState("");
  const [comisiones, setComisiones] = useState("");
  const [base, setBase] = useState("");
  const [feriados, setFeriados] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Al cambiar de mes se cargan sus datos, o se limpia si no hay nada.
  useEffect(() => {
    if (!guardado) return;
    const i = guardado.insumos;
    setSalario(i ? String(i.salarioCRC) : "");
    setComisiones(i ? String(i.comisionesCRC) : "");
    setBase(i ? String(i.baseImponibleCRC) : "");
    /* Tres casos, y el del medio es el que importa:
       · mes sin registrar → lo detectado (dejarlo vacío obligaría a contar
         feriados a mano teniéndolos ahí);
       · mes registrado ANTES de A129 (`null`) → lo detectado. Ese `null` no es
         una decisión de nadie: el campo no existía. Respetarlo como cero haría
         que el recargo **no apareciera nunca** en los meses viejos, que es
         justo donde ya hay un pago corto;
       · mes registrado CON el campo → lo suyo, aunque sea cero, porque ahí sí
         hubo una decisión y recalcularla le pisaría una corrección. */
    setFeriados(
      String(i?.feriadosDias ?? guardado.feriadosDetectados.dias),
    );
    setOk(null);
    setError(null);
  }, [guardado?.yearMonth, guardado?.insumos?.updatedAt]);

  const num = (s: string) => {
    const n = Number(s.replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  /**
   * Los días de feriado **sí llevan decimal** (medio día), así que no pueden
   * pasar por `num`, que borra todo lo que no sea dígito y convertiría «0,5» en
   * 5. Se acepta coma o punto: en Costa Rica se escribe con coma, y el teclado
   * numérico del teléfono da punto.
   */
  const numDias = (s: string) => {
    const n = Number(s.replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  /**
   * La vista previa usa **la misma función** que el servidor (`@/lib/payroll`).
   * Es lo que garantiza que lo que Esteban ve mientras escribe sea exactamente
   * lo que se va a guardar — si estuviera duplicada, tarde o temprano una de las
   * dos se quedaría atrás.
   */
  const preview = useMemo(
    () =>
      calcularPlanilla(
        {
          salarioCRC: num(salario),
          comisionesCRC: num(comisiones),
          baseImponibleCRC: num(base),
          feriadosDias: numDias(feriados),
        },
        /**
         * **La tasa vigente, no la guardada — A144.**
         *
         * Esto usaba `insumos.tasas` (la que quedó grabada) mientras la mutation
         * escribe con `tasasDelMes(mes)`, porque la pantalla nunca manda tasas.
         * Hoy coinciden y por eso no se notaba; el día que se corrija una
         * vigencia, **la vista previa mostraría un número y el botón grabaría
         * otro** — y la vista previa existe precisamente para que lo que se ve
         * sea lo que se guarda.
         *
         * `tasasPorDefecto` viene de `vigenciaDelMes(mes)`, que es la misma
         * función que usa la mutation.
         */
        guardado?.tasasPorDefecto ?? TASAS_POR_DEFECTO,
      ),
    [salario, comisiones, base, feriados, guardado?.tasasPorDefecto],
  );

  const total = preview.reduce((a, l) => a + l.amountCRC, 0);
  const yaRegistrado = !!guardado?.insumos;
  const sinDatos = num(salario) === 0 && num(comisiones) === 0 && num(base) === 0;

  /**
   * El mes ya trae estas líneas por otra vía (**B34**), así que registrarlo
   * duplicaría el gasto. El servidor lo rechaza igual; acá se avisa antes para
   * que no llene el formulario en vano, y se apaga el botón.
   */
  const yaCargadas = guardado?.lineasYaCargadas ?? [];
  const bloqueado = yaCargadas.length > 0;
  const totalYaCargado = yaCargadas.reduce((a, l) => a + l.amountCRC, 0);

  /**
   * El aporte patronal cambió de 26,92% a 28,28% en agosto (**B36**). Se muestra
   * cuál rige y por qué: si el mes que sale en pantalla usa un porcentaje
   * distinto al del mes pasado, eso tiene que ser una explicación visible y no
   * una sorpresa.
   */
  const vigencia = guardado?.vigencia;
  const todosLosFeriados = guardado?.feriadosDetectados.detalle ?? [];
  const detectados = todosLosFeriados.filter((f) => f.tipo === "obligatorio");
  /** Trabajados pero **de pago no obligatorio**: no generan recargo. */
  const noObligatorios = todosLosFeriados.filter((f) => f.tipo !== "obligatorio");
  /** Mes ya registrado cuyo `feriadosDias` es `null`: se grabó antes de A129. */
  const registradoSinFeriados =
    !!guardado?.insumos && guardado.insumos.feriadosDias === null;
  const avisoINS = guardado?.avisoPolizaINS ?? null;

  // Se publica una vez el setter del campo de comisiones (ver la prop).
  useEffect(() => {
    onListoParaSugerencias?.((montoCRC: number) => setComisiones(String(montoCRC)));
  }, [onListoParaSugerencias]);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    setOk(null);
    try {
      const res = await onRegistrar({
        yearMonth: mes,
        salarioCRC: num(salario),
        comisionesCRC: num(comisiones),
        baseImponibleCRC: num(base),
        feriadosDias: numDias(feriados),
      });
      /**
       * **Dice las dos cosas, no solo una — A151.**
       *
       * Decía «N líneas entraron a Finanzas» en cuanto se creaba **alguna**, y
       * callaba las corregidas. Corregir un mes ya registrado suele crear una y
       * actualizar ocho: el mensaje informaba la de menos y escondía el trabajo
       * real, que es justo lo que el usuario quiere confirmar. Y con `creadas`
       * en 1 decía «1 líneas».
       */
      setOk(resumen(res.creadas, res.actualizadas));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const input =
    "min-h-11 w-full rounded-xl border border-[var(--bi-ring)] bg-[var(--bi-surface-2)] px-3 text-[15px] text-[var(--bi-ink)] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]";

  return (
    <BiCard
      title="Planilla del mes"
      subtitle="Escribí los datos del mes y el resto se calcula solo"
    >
      <div className="space-y-5">
        {/* Mes */}
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-[var(--bi-ink-3)]">
            Mes
          </span>
          <input
            type="month"
            value={mes}
            onChange={(e) => onMes(e.target.value || mesActual())}
            className={cn(input, "mt-1 sm:max-w-[220px]")}
          />
        </label>

        {/* El mes ya viene cargado por otra vía: se avisa acá, pegado al
            selector de mes, porque la causa es el mes elegido y no lo que
            escriba después. */}
        {bloqueado ? (
          <div className="rounded-xl border border-[var(--bi-expense)]/40 bg-[var(--bi-expense)]/10 px-4 py-3">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--bi-expense)]">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {formatMonthLong(mes)} ya tiene la planilla cargada
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
              Hay {yaCargadas.length}{" "}
              {yaCargadas.length === 1 ? "línea" : "líneas"} por{" "}
              <b>{formatCRC(totalYaCargado)}</b> que vinieron de la hoja o se
              escribieron a mano. Registrar el mes acá{" "}
              <b className="text-[var(--bi-expense)]">las duplicaría</b> en vez de
              corregirlas, porque son registros distintos.
            </p>
            <ul className="mt-2 space-y-1">
              {yaCargadas.map((l, i) => (
                <li
                  key={`${l.etiqueta}-${i}`}
                  className="flex items-baseline justify-between gap-3 text-[12.5px] text-[var(--bi-ink-3)]"
                >
                  <span className="min-w-0 truncate">{l.etiqueta}</span>
                  <span className="bi-num shrink-0 tabular-nums">
                    {formatCRC(l.amountCRC)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[12.5px] text-[var(--bi-ink-3)]">
              Elegí otro mes. Si de verdad querés reemplazarlas, escribinos: hay
              que dar de baja primero las que ya están.
            </p>
          </div>
        ) : null}

        {/* Qué tasa rige este mes, y por qué */}
        {vigencia ? (
          <p className="text-[12px] leading-relaxed text-[var(--bi-ink-3)]">
            Aporte patronal de este mes:{" "}
            {/* Sin `tabular-nums`: acá el porcentaje es prosa, no una columna
                que deba alinearse, y las cifras tabulares le dan a la coma el
                ancho de un dígito — «28,28%» se lee «28 , 28%». */}
            <b className="text-[var(--bi-ink-2)]">
              {`${String(
                guardado?.insumos?.tasas.aportePatronalPct ??
                  guardado?.tasasPorDefecto.aportePatronalPct ??
                  "",
              ).replace(".", ",")}%`}
            </b>{" "}
            — {vigencia.nota}
          </p>
        ) : null}

        {/* La póliza del INS contada dos veces */}
        {avisoINS ? (
          <div className="rounded-xl border border-[var(--bi-warn)]/40 bg-[var(--bi-warn)]/10 px-4 py-3">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--bi-warn)]">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              El INS podría estar contado dos veces
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
              Desde agosto el aporte patronal es 28,28% y{" "}
              <b>ya trae adentro el 2,45% del INS</b>. Pero este mes también tiene
              una línea suelta de{" "}
              <b>{avisoINS.etiqueta} por {formatCRC(avisoINS.amountCRC)}</b> en
              «seguro».
            </p>
            <p className="mt-1.5 text-[12.5px] text-[var(--bi-ink-3)]">
              Si es la misma póliza, sobra una de las dos. No te bloqueamos el
              mes: puede que cubra otra cosa y eso lo sabés vos.
            </p>
          </div>
        ) : null}

        {/* Los tres datos */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { l: "Salario bruto de Sergio", v: salario, set: setSalario },
            { l: "Comisiones del mes", v: comisiones, set: setComisiones },
            { l: "Base a reportar", v: base, set: setBase },
          ].map((f) => (
            <label key={f.l} className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--bi-ink-3)]">
                {f.l}
              </span>
              <input
                inputMode="numeric"
                value={f.v}
                onChange={(e) => f.set(e.target.value)}
                placeholder="0"
                className={cn(input, "mt-1")}
              />
            </label>
          ))}
        </div>

        {/*
          Los feriados van **fuera de la grilla de los tres montos** y con su
          explicación al lado, porque es el único campo que el sistema propone en
          vez de esperar: se cuenta desde las revisiones. Se muestra siempre,
          también cuando da cero — un campo que mueve el pago y aparece solo a
          veces es peor que uno que aparece siempre diciendo «ninguno».
        */}
        <div className="rounded-xl border border-[var(--bi-ring)] p-4">
          <div className="flex flex-wrap items-start gap-4">
            <label className="block w-full sm:w-[150px] sm:shrink-0">
              {/* `block` en el rótulo: sin eso, al acotar el ancho del campo el
                  texto y el input caben en la misma línea y el rótulo se va al
                  costado, distinto del resto del formulario. */}
              <span className="block text-xs uppercase tracking-wide text-[var(--bi-ink-3)]">
                Días de feriado trabajados
              </span>
              <input
                inputMode="decimal"
                value={feriados}
                onChange={(e) => setFeriados(e.target.value)}
                placeholder="0"
                className={cn(input, "mt-1")}
              />
              <span className="mt-1 block text-[11.5px] text-[var(--bi-ink-3)]">
                Medio día se escribe <b>0,5</b>
              </span>
            </label>
            <div className="min-w-[220px] flex-1 text-[12.5px] leading-relaxed text-[var(--bi-ink-2)]">
              {detectados.length > 0 ? (
                <>
                  <p>
                    El sistema encontró{" "}
                    <b className="text-[var(--bi-ink)]">
                      {detectados.length === 1
                        ? "1 feriado de pago obligatorio"
                        : `${detectados.length} feriados de pago obligatorio`}
                    </b>{" "}
                    con revisiones de un técnico este mes:
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {detectados.map((f) => (
                      <li key={`${f.fecha}|${f.tecnico}`}>
                        · <b className="text-[var(--bi-ink)]">{f.nombre}</b>{" "}
                        ({formatIsoDateCR(f.fecha)}) — {f.tecnico}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[var(--bi-ink-3)]">
                    El sistema cuenta <b>un día por feriado</b>, que es lo que
                    puede saber: ve que hubo revisiones, no cuántas horas. Si
                    trabajó <b>medio día</b>, poné <b>0,5</b>; también podés
                    subirlo si trabajó un feriado sin hacer revisiones, o
                    bajarlo si no le corresponde.
                  </p>
                </>
              ) : (
                <p className="text-[var(--bi-ink-3)]">
                  Este mes <b>ningún técnico registró revisiones en un feriado de
                  pago obligatorio</b>. Si aun así trabajó uno, escribilo acá.
                </p>
              )}
              {/* El feriado trabajado que NO genera recargo se nombra igual. Si
                  se omite, un día que el técnico sí trabajó queda invisible y la
                  pregunta «¿y el 31 de agosto?» aparece igual, pero sin
                  respuesta en pantalla (A64/A88). */}
              {noObligatorios.length > 0 ? (
                <div className="mt-2 border-t border-[var(--bi-ring)] pt-2">
                  <p className="text-[var(--bi-ink-2)]">
                    También se trabajó{" "}
                    {noObligatorios.map((f, i) => (
                      <span key={`${f.fecha}|${f.tecnico}`}>
                        {i > 0 ? ", " : ""}
                        <b className="text-[var(--bi-ink)]">{f.nombre}</b> (
                        {formatIsoDateCR(f.fecha)})
                      </span>
                    ))}
                    , pero {noObligatorios.length === 1 ? "es" : "son"} de{" "}
                    <b>pago no obligatorio</b>: se{" "}
                    {noObligatorios.length === 1 ? "paga" : "pagan"} sencillo
                    salvo que tengas otro acuerdo, así que no suma
                    {noObligatorios.length === 1 ? "" : "n"} días acá.
                  </p>
                </div>
              ) : null}
              <p className="mt-2 border-t border-[var(--bi-ring)] pt-2 text-[var(--bi-ink-3)]">
                Cada día suma <b>un salario diario</b> (salario ÷ 30) — el que
                falta para llegar al doble, porque el salario del mes ya paga ese
                día se trabaje o no.
              </p>
              {/* El hueco va ruidoso (A64/A88): un mes que quedó corto y no lo
                  dice se queda corto para siempre. */}
              {registradoSinFeriados && detectados.length > 0 ? (
                <p className="mt-2 rounded-lg bg-[var(--bi-surface-2)] p-2.5 text-[var(--bi-ink-2)]">
                  <b className="text-[var(--bi-ink)]">
                    Este mes se registró antes de que la planilla mirara los
                    feriados
                  </b>
                  , así que hoy <b>no incluye el recargo</b>. Apretá «Actualizar
                  el mes» para agregarlo.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Lo que se va a registrar, visible ANTES de confirmar */}
        <div className="rounded-xl border border-[var(--bi-ring)]">
          <div className="border-b border-[var(--bi-ring)] px-4 py-2.5">
            <p className="text-[13px] font-semibold text-[var(--bi-ink)]">
              Lo que se va a registrar en {formatMonthLong(mes)}
            </p>
          </div>
          <ul className="divide-y divide-[var(--bi-ring)]">
            {preview.map((l) => (
              <li
                key={l.linea}
                className="flex items-baseline justify-between gap-3 px-4 py-2.5"
              >
                <span className="min-w-0">
                  <span className="text-[13.5px] text-[var(--bi-ink)]">{l.label}</span>
                  <span className="ml-2 text-[11.5px] text-[var(--bi-ink-3)]">
                    {l.formula}
                  </span>
                </span>
                <span className="bi-num shrink-0 tabular-nums text-[var(--bi-ink)]">
                  {formatCRC(l.amountCRC)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between gap-3 border-t border-[var(--bi-ring)] px-4 py-3">
            <span className="text-[13px] font-semibold text-[var(--bi-ink)]">
              Total del mes
            </span>
            <span className="bi-num tabular-nums text-[15px] font-bold text-[var(--bi-expense)]">
              {formatCRC(total)}
            </span>
          </div>
        </div>

        {/* Estado y acción */}
        {yaRegistrado ? (
          <p className="text-xs text-[var(--bi-ink-3)]">
            Este mes ya está registrado
            {guardado?.insumos
              ? ` (última vez: ${formatDateCR(guardado.insumos.updatedAt)})`
              : ""}
            . Confirmar otra vez <b className="text-[var(--bi-ink-2)]">corrige</b>{" "}
            las líneas; no las duplica.
          </p>
        ) : null}

        {error ? (
          <p className="text-[13px] text-[var(--bi-expense)]">{error}</p>
        ) : null}
        {ok ? (
          <p className="flex items-center gap-2 text-[13px] text-[var(--bi-income)]">
            <CheckCircle2 className="size-4" aria-hidden />
            {ok}
          </p>
        ) : null}

        <button
          type="button"
          onClick={confirmar}
          disabled={guardando || sinDatos || bloqueado}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--bi-income)]/40 bg-[var(--bi-income)]/10 px-4 text-sm font-semibold text-[var(--bi-income)] transition-colors",
            "hover:bg-[var(--bi-income)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {guardando ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {yaRegistrado ? "Actualizar el mes" : "Registrar el mes"}
        </button>

        <p className="border-t border-[var(--bi-ring)] pt-3 text-xs leading-relaxed text-[var(--bi-ink-3)]">
          <b className="text-[var(--bi-ink)]">
            El salario y las comisiones también entran a Finanzas como gasto
          </b>{" "}
          — no hace falta anotarlos por otro lado. Todas las líneas entran
          marcadas como calculadas y{" "}
          <b className="text-[var(--bi-ink-2)]">no se editan a mano</b>: si te
          equivocaste en un dato, corregilo acá arriba y se recalculan solas. Así
          nunca queda una provisión con un número viejo.
        </p>
      </div>
    </BiCard>
  );
}
