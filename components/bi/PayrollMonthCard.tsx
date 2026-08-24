"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import {
  formatCRC,
  formatDateCR,
  formatMonthLong,
  toDateInputValue,
} from "@/lib/bi-format";
import { TASAS_POR_DEFECTO, calcularPlanilla, type Tasas } from "@/lib/payroll";
import { cn } from "@/lib/utils";

/** `"2026-07"` del mes en curso, en zona CR. */
function mesActual(): string {
  return toDateInputValue(Date.now()).slice(0, 7);
}

/**
 * Planilla del mes — los gastos que se calculan solos (B28).
 *
 * Esteban escribe **tres** datos y el sistema deriva **seis** líneas. Hoy hace
 * esas cuentas a mano en su hoja, y el error más caro que tuvimos —₡98.599 de
 * julio— salió justo de ahí: llenó las comisiones después, la hoja recalculó
 * sola y el sistema se quedó con la foto vieja.
 *
 * Dos decisiones de esta pantalla:
 *
 * 1. **El cálculo se ve ANTES de confirmar.** No es un botón que hace algo
 *    invisible: las seis líneas y su fórmula están en pantalla mientras escribe.
 *    Si un número lo sorprende, el porqué está al lado.
 * 2. **Confirmar el mismo mes corrige, no duplica.** Por eso el botón cambia a
 *    «Actualizar» cuando el mes ya está registrado, y se dice explícitamente que
 *    las seis se recalculan. Sin eso, la duda razonable es «¿lo voy a meter dos
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
    tasas: Tasas;
    updatedAt: number;
  } | null;
  tasasPorDefecto: Tasas;
};

export function PayrollMonthCard({
  mes,
  onMes,
  guardado,
  onRegistrar,
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
  }) => Promise<{ creadas: number; actualizadas: number }>;
}) {

  const [salario, setSalario] = useState("");
  const [comisiones, setComisiones] = useState("");
  const [base, setBase] = useState("");
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
    setOk(null);
    setError(null);
  }, [guardado?.yearMonth, guardado?.insumos?.updatedAt]);

  const num = (s: string) => {
    const n = Number(s.replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
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
        },
        guardado?.insumos?.tasas ?? guardado?.tasasPorDefecto ?? TASAS_POR_DEFECTO,
      ),
    [salario, comisiones, base, guardado?.tasasPorDefecto, guardado?.insumos?.tasas],
  );

  const total = preview.reduce((a, l) => a + l.amountCRC, 0);
  const yaRegistrado = !!guardado?.insumos;
  const sinDatos = num(salario) === 0 && num(comisiones) === 0 && num(base) === 0;

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
      });
      setOk(
        res.creadas > 0
          ? `Listo: ${res.creadas} líneas entraron a Finanzas.`
          : `Listo: se actualizaron las ${res.actualizadas} líneas del mes.`,
      );
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
      subtitle="Escribí tres datos y el resto se calcula solo"
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
            las seis líneas; no las duplica.
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
          disabled={guardando || sinDatos}
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
          Las seis líneas entran a Finanzas marcadas como calculadas y{" "}
          <b className="text-[var(--bi-ink-2)]">no se editan a mano</b>: si te
          equivocaste en un dato, corregilo acá arriba y las seis se recalculan
          solas. Así nunca queda una provisión con un número viejo.
        </p>
      </div>
    </BiCard>
  );
}
