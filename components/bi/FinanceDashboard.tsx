"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCompactCRC,
  formatCRC,
  formatInt,
  formatMonthLong,
  formatMonthShort,
  formatPct,
  categoryLabel,
  variacion,
} from "@/lib/bi-format";
import { BiCard } from "./BiCard";
import { BiCategoryBars } from "./BiCategoryBars";
import {
  ExpenseGroupsCard,
  type ExpenseBreakdown,
} from "./ExpenseGroupsCard";
import { BiEntriesTable } from "./BiEntriesTable";
import { BiEntryDrawer } from "./BiEntryDrawer";
import { BiKpiCard } from "./BiKpiCard";
import { BiMonthlyBars } from "./BiMonthlyBars";
import { ConciliacionCard } from "./ConciliacionCard";
import { ContrasteHojaCard } from "./ContrasteHojaCard";
import type {
  FinanceEntry,
  FinanceEntryInput,
  ContrasteHoja,
  FinanceSummary,
  Reconciliation,
} from "./types";

/**
 * Tablero de Finanzas — capa 100% presentacional (recibe datos y handlers).
 * Estilo "grafito de precisión": superficie oscura, acento cian para ingresos,
 * ámbar para gastos (paleta validada), tipografía condensada solo en títulos.
 */
export function FinanceDashboard({
  summary,
  entries,
  selectedMonth,
  onSelectMonth,
  onSubmitEntry,
  onDeleteEntry,
  loadingEntries = false,
  readOnly = false,
  expenseBreakdown,
  conciliacion,
  contrasteHoja,
}: {
  summary: FinanceSummary;
  entries: FinanceEntry[];
  selectedMonth: string | null;
  onSelectMonth: (ym: string | null) => void;
  onSubmitEntry: (input: FinanceEntryInput, id?: string) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  loadingEntries?: boolean;
  /** Vista de muestra (revisión visual): desactiva las acciones de escritura. */
  readOnly?: boolean;
  /** Desglose de gastos por proveedor (A83/A98). Si no llega, no se pinta. */
  expenseBreakdown?: ExpenseBreakdown;
  /** Periodo del desglose. Sin estas dos, la tarjeta no muestra el filtro. */
  /** Conciliación finanzas ↔ revisiones (mitad de RF-05). Si no llega, no se pinta. */
  conciliacion?: Reconciliation;
  /** Contraste hoja ↔ Convex (A56). Si no llega, no se pinta. */
  contrasteHoja?: ContrasteHoja;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [confirm, setConfirm] = useState<FinanceEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sourceFilter, setSourceFilter] = useState<FinanceEntry["source"] | "todos">("todos");

  const { months, totals } = summary;

  /**
   * Filtro por origen. Con F5-auto la tabla pasa de ~7 filas de ingreso al mes a
   * una por inspección (~45–65), así que hace falta poder aislar lo que Esteban
   * escribió a mano de lo que generó el sistema. Solo se muestra cuando hay más
   * de un origen presente: si todo viene del Sheet, el control sobra.
   */
  const sourceCounts = useMemo(() => {
    const counts = new Map<FinanceEntry["source"], number>();
    for (const e of entries) counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
    return counts;
  }, [entries]);

  const sourceOptions = useMemo(() => {
    const labels: Record<FinanceEntry["source"], string> = {
      inspection: "Automáticos",
      manual: "Manuales",
      planilla: "De planilla",
      sheet: "Sheet",
    };
    /* «De planilla» faltaba: sus filas existían desde A123 y **no había forma de
       aislarlas** con ningún filtro. Lo destapó el compilador al ensanchar el
       tipo de `source` (A144), no una lectura del código. */
    return (["inspection", "manual", "planilla", "sheet"] as const)
      // El origen elegido se queda aunque el mes filtrado no tenga filas suyas:
      // si el botón desapareciera, la tabla quedaría vacía sin explicación.
      .filter((s) => (sourceCounts.get(s) ?? 0) > 0 || s === sourceFilter)
      .map((s) => ({ value: s, label: labels[s], count: sourceCounts.get(s) ?? 0 }));
  }, [sourceCounts, sourceFilter]);

  const visibleEntries = useMemo(
    () =>
      sourceFilter === "todos"
        ? entries
        : entries.filter((e) => e.source === sourceFilter),
    [entries, sourceFilter],
  );

  // El periodo mostrado en los KPIs: el mes elegido, o el acumulado.
  const monthIdx = selectedMonth
    ? months.findIndex((m) => m.yearMonth === selectedMonth)
    : -1;
  const current = monthIdx >= 0 ? months[monthIdx] : null;
  const previous = monthIdx > 0 ? months[monthIdx - 1] : null;

  const view = current
    ? {
        income: current.income,
        expense: current.expense,
        utilidad: current.utilidad,
        marginPct: current.marginPct,
        rows: current.rows,
      }
    : {
        income: totals.income,
        expense: totals.expense,
        utilidad: totals.utilidad,
        marginPct: totals.marginPct,
        rows: totals.rows,
      };

  /**
   * **Nombra el mes con que compara, en vez de decir «anterior» — A135.**
   *
   * Decía «30,6% vs anterior» y anterior a qué es justo lo que el lector no
   * sabe: ¿el mes pasado, el mismo mes del año pasado, el promedio? Con el
   * nombre no queda duda, y ocupa lo mismo o menos («vs junio» contra «vs mes
   * anterior», que era lo que se truncaba en móvil).
   *
   * El cálculo ya no vive acá: es `variacion` en `@/lib/bi-format`, compartido
   * con la portada. Dos copias de la misma fórmula en dos pantallas es la forma
   * más fácil de que un día muestren números distintos (A125 · A128).
   */
  const contraMes = previous
    ? `vs ${formatMonthShort(previous.yearMonth).toLowerCase()}`
    : "vs anterior";
  const delta = (now: number, before: number | undefined) =>
    variacion(now, before, contraMes);

  /**
   * **El reparto del gasto se suma en el servidor — A153.**
   *
   * Se calculaba acá sobre `entries`, y la pantalla abre **sin mes elegido**
   * pidiendo `limit: 200`. Con 663 movimientos vivos, el reparto salía sobre los
   * tres meses más recientes —**≈₡6,2M de ₡31,4M, un 19,8%**— bajo un subtítulo
   * que decía «Movimientos cargados»: ni una palabra del negocio, ni el número,
   * ni el rango.
   *
   * El comentario que estaba acá decía «completo para un mes», y era cierto —
   * **cuando hay un mes puesto**. El estado por defecto no lo tiene, así que la
   * frase describía el caso que no era el de siempre. **Un borde declarado deja
   * de revisarse** (A148): por eso sobrevivió a dos rondas.
   *
   * Mismo error que A114 (el conteo de filas) y A146 (el monto cobrado), ahora
   * en la pantalla de la plata. `porCategoria` llega opcional por la ventana
   * entre despliegues (A115); mientras no llegue, la tarjeta lo dice en vez de
   * mostrar un reparto a medias.
   */
  const mesElegido = selectedMonth
    ? months.find((m) => m.yearMonth === selectedMonth)
    : undefined;

  const catsDelServidor = selectedMonth
    ? mesElegido?.porCategoria
    : summary.porCategoria;

  const expenseByCategory = useMemo(
    () =>
      (catsDelServidor ?? []).map((c) => ({
        category: c.category,
        amountCRC: c.amountCRC,
      })),
    [catsDelServidor],
  );

  /** Del servidor también: el del periodo, no el de lo que alcanzó a llegar. */
  const viaticoTotal = selectedMonth
    ? (mesElegido?.viaticoAmountCRC ?? 0)
    : totals.viaticoAmountCRC;

  /** Cuántos movimientos de gasto sostienen el reparto. Va en el subtítulo. */
  const gastosContados = (catsDelServidor ?? []).reduce((n, c) => n + c.rows, 0);

  /** Cuántos hay de verdad en el periodo — para que la tabla no diga su tope. */
  const totalFilas = selectedMonth
    ? (mesElegido?.rows ?? 0)
    : totals.rows;

  const showFlash = (msg: string, ok = true) => {
    setFlash({ msg, ok });
    window.setTimeout(() => setFlash(null), 2400);
  };

  const handleSubmit = async (input: FinanceEntryInput) => {
    // Un fallo se propaga a propósito: el formulario lo muestra en su lugar.
    await onSubmitEntry(input, editing?.id);
    showFlash(editing ? "Movimiento actualizado" : "Movimiento registrado");
  };

  const handleDelete = async (entry: FinanceEntry) => {
    setBusyId(entry.id);
    try {
      await onDeleteEntry(entry.id);
      showFlash("Movimiento eliminado");
    } catch (e) {
      // Sin este catch el fallo quedaría en silencio (el usuario creería que
      // se borró). Se informa y la fila permanece.
      showFlash(
        e instanceof Error ? e.message : "No se pudo eliminar el movimiento",
        false,
      );
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  const periodLabel = selectedMonth
    ? formatMonthLong(selectedMonth)
    : "Todo el histórico";

  return (
    /* El tema (`.bi-graphite`, plano y tinta) lo aplica el contenedor: el shell
       de `/admin` o el envoltorio de la vista de revisión. Este componente solo
       maqueta —antes cancelaba el padding del `main` con márgenes negativos. */
    <div>
      {/* ---------- encabezado ---------- */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
            Finanzas
          </h1>
          <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
            {periodLabel} · {formatInt(view.rows)} movimientos ·{" "}
            {formatInt(months.length)} meses con datos
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedMonth ? (
            <button
              type="button"
              onClick={() => onSelectMonth(null)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--bi-ring)] px-3 py-2 text-[13px] font-medium text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] active:scale-[0.98]"
            >
              <RotateCcw className="size-4" aria-hidden />
              Ver todo
            </button>
          ) : null}
          {!readOnly ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDrawerOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--bi-income)] px-4 py-2 text-[13px] font-semibold text-[#06222a] transition-[filter,transform] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bi-plane)] active:scale-[0.98]"
            >
              <Plus className="size-4" aria-hidden />
              Registrar movimiento
            </button>
          ) : null}
        </div>
      </header>

      {/* ---------- KPIs ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BiKpiCard
          index={0}
          label="Ingresos"
          tone="income"
          value={formatCompactCRC(view.income)}
          exact={formatCRC(view.income)}
          delta={current ? delta(current.income, previous?.income) : null}
        />
        <BiKpiCard
          index={1}
          label="Gastos"
          tone="expense"
          value={formatCompactCRC(view.expense)}
          exact={formatCRC(view.expense)}
          delta={current ? delta(current.expense, previous?.expense) : null}
          hint={
            view.income > 0
              ? `${formatPct((view.expense / view.income) * 100)} de ingresos`
              : undefined
          }
        />
        <BiKpiCard
          index={2}
          label="Utilidad"
          tone="utilidad"
          value={formatCompactCRC(view.utilidad)}
          exact={formatCRC(view.utilidad)}
          delta={current ? delta(current.utilidad, previous?.utilidad) : null}
        />
        <BiKpiCard
          index={3}
          label="Margen"
          tone="neutral"
          value={formatPct(view.marginPct)}
          hint={
            selectedMonth
              ? undefined
              : `${formatInt(totals.viaticoCount)} viáticos · ${formatCRC(totals.viaticoAmountCRC)}`
          }
        />
      </div>

      {/* ---------- gráfico + desglose ---------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.9fr_1fr]">
        <BiCard
          title="Ingresos y gastos por mes"
          subtitle="Todo convertido a colones"
        >
          <BiMonthlyBars
            months={months}
            selected={selectedMonth}
            onSelect={(ym) => onSelectMonth(ym === selectedMonth ? null : ym)}
          />
        </BiCard>

        <BiCard
          title="Gastos por categoría"
          /* **El subtítulo dice sobre qué suma — A153.** Decía «Movimientos
             cargados»: ni una palabra del negocio, ni el número, ni el rango, y
             era lo único que se interponía entre Esteban y un reparto del 19,8%
             del gasto rotulado como el histórico. */
          subtitle={
            catsDelServidor == null
              ? "Cargando…"
              : `${
                  selectedMonth ? formatMonthLong(selectedMonth) : "Todo el periodo"
                } · ${formatInt(gastosContados)} ${
                  gastosContados === 1 ? "movimiento" : "movimientos"
                } de gasto`
          }
        >
          {catsDelServidor == null ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="bi-skeleton h-3 w-2/3 rounded" />
                  <div className="bi-skeleton h-[6px] w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <BiCategoryBars rows={expenseByCategory} tone="expense" />
              {viaticoTotal > 0 ? (
                <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-xs text-[var(--bi-ink-3)]">
                  Incluye{" "}
                  <span className="bi-num text-[var(--bi-ink-2)]">
                    {formatCRC(viaticoTotal)}
                  </span>{" "}
                  en viáticos.
                </p>
              ) : null}
            </>
          )}
        </BiCard>

        {/* El desglose de «Otros» va inmediatamente después de las categorías:
            es un zoom sobre la barra más grande y sin nombre de la de arriba. */}
        {expenseBreakdown ? (
          <ExpenseGroupsCard
            data={expenseBreakdown}
            /* Sin control propio — A158. Sigue al periodo de la barra y al mes
               elegido, igual que las otras dos tarjetas de gasto. */
            alcance={
              selectedMonth ? formatMonthLong(selectedMonth) : "Todo el periodo"
            }
          />
        ) : null}
      </div>

      {/* ---------- conciliación ----------
          Va DESPUÉS de los gráficos y ANTES de la tabla a propósito: contesta
          «¿me puedo creer los números de arriba?», así que no sirve encima de
          ellos —no habría qué dudar todavía— ni al final, donde nadie llega. */}
      {conciliacion ? (
        <div className="mt-4">
          <ConciliacionCard data={conciliacion} />
        </div>
      ) : null}

      {/* ---------- contraste con la hoja ----------
          Debajo de la conciliación y no encima: aquella contesta «¿cuadra lo
          cobrado con lo revisado?» —sobre datos de acá— y esta «¿seguimos
          diciendo lo mismo que la hoja?», que es una duda sobre el origen. */}
      {contrasteHoja ? (
        <div className="mt-4">
          <ContrasteHojaCard data={contrasteHoja} />
        </div>
      ) : null}

      {/* ---------- tabla ---------- */}
      <div className="mt-4">
        <BiCard
          title="Movimientos"
          subtitle={periodLabel}
          bodyClassName="pt-0"
          action={
            loadingEntries ? (
              <span className="inline-flex items-center gap-2 text-xs text-[var(--bi-ink-3)]">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Cargando…
              </span>
            ) : (
              /**
               * **El conteo dice cuántas hay, no cuántas llegaron — A155.**
               *
               * Decía `entries.length`, y sin mes elegido `entries` viene con
               * tope de 200. Con 663 movimientos vivos la tarjeta rotulada
               * «Todo el histórico» anunciaba **200 filas**: el mismo error de
               * A114 (el conteo de Inspecciones) y A146 (el monto cobrado).
               *
               * Y es el mismo de **A153**, en esta misma tarjeta, tres horas
               * antes: ahí se arreglaron el desglose por categoría y el total de
               * viáticos y **este contador quedó**. El patrón del arreglo que no
               * se propaga, dentro del componente que se estaba arreglando. Lo
               * destapó Greety mandando la foto de su propia pantalla.
               */
              <span className="bi-num text-xs text-[var(--bi-ink-3)]">
                {sourceFilter !== "todos"
                  ? `${formatInt(visibleEntries.length)} de ${formatInt(entries.length)} filas`
                  : entries.length < totalFilas
                    ? `${formatInt(entries.length)} de ${formatInt(totalFilas)} filas`
                    : `${formatInt(entries.length)} filas`}
              </span>
            )
          }
        >
          {catsDelServidor == null ? (
            <div className="space-y-2 pt-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="bi-skeleton h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {sourceOptions.length > 1 ? (
                <div
                  role="group"
                  aria-label="Filtrar movimientos por origen"
                  className="flex flex-wrap items-center gap-1.5 pb-3 pt-4"
                >
                  {[
                    { value: "todos" as const, label: "Todos", count: entries.length },
                    ...sourceOptions,
                  ].map((opt) => {
                    const active = sourceFilter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSourceFilter(opt.value)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs transition-colors",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
                          active
                            ? "border-[var(--bi-income)] bg-[var(--bi-income)]/12 text-[var(--bi-ink)]"
                            : "border-[var(--bi-ring)] text-[var(--bi-ink-3)] hover:text-[var(--bi-ink-2)]",
                        )}
                      >
                        {opt.label}
                        <span className="bi-num ml-1.5 text-[var(--bi-ink-3)]">
                          {formatInt(opt.count)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <BiEntriesTable
                entries={visibleEntries}
                busyId={busyId}
                onEdit={
                  readOnly
                    ? undefined
                    : (e) => {
                        setEditing(e);
                        setDrawerOpen(true);
                      }
                }
                onDelete={readOnly ? undefined : (e) => setConfirm(e)}
              />
            </>
          )}
        </BiCard>
      </div>

      {/* ---------- aviso de guardado ---------- */}
      {flash ? (
        <div
          role="status"
          className={cn(
            "bi-flash fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border bg-[var(--bi-surface-2)] px-4 py-2.5 text-[13px] font-medium text-[var(--bi-ink)] shadow-2xl",
            flash.ok
              ? "border-[var(--bi-good)]/40"
              : "border-[var(--bi-bad)]/50",
          )}
        >
          {/* icono + rótulo: el estado no se comunica solo con color */}
          <span className="inline-flex items-center gap-2">
            {flash.ok ? (
              <CheckCircle2
                className="size-4 shrink-0"
                style={{ color: "var(--bi-good)" }}
                aria-hidden
              />
            ) : (
              <AlertTriangle
                className="size-4 shrink-0"
                style={{ color: "var(--bi-bad)" }}
                aria-hidden
              />
            )}
            {flash.msg}
          </span>
        </div>
      ) : null}

      {/* ---------- confirmación de borrado ---------- */}
      {confirm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cancelar"
            onClick={() => setConfirm(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bi-confirm-title"
            className="bi-fade-up relative w-full max-w-[380px] rounded-2xl border border-[var(--bi-ring)] bg-[var(--bi-surface)] p-5 shadow-2xl"
          >
            <h2
              id="bi-confirm-title"
              className="text-[15px] font-semibold text-[var(--bi-ink)]"
            >
              ¿Eliminar este movimiento?
            </h2>
            <p className="mt-1.5 text-[13px] text-[var(--bi-ink-3)]">
              Se marca como eliminado y deja de contar en los totales. Queda
              registrado y es reversible desde el backend.
            </p>
            <p className="bi-num mt-3 rounded-xl border border-[var(--bi-ring)] bg-[var(--bi-plane)] px-3 py-2 text-[13px] text-[var(--bi-ink-2)]">
              {/* La etiqueta, no la llave interna: decía «servicios_profesionales»
                  en el diálogo que confirma dar de baja plata (A144). */}
              {formatCRC(confirm.amountCRC)} · {categoryLabel(confirm.category)}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-xl border border-[var(--bi-ring)] px-4 py-2.5 text-[14px] font-medium text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirm)}
                disabled={busyId === confirm.id}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[#2a0b0b] transition-[filter,transform] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-bad)] active:scale-[0.98] disabled:opacity-60",
                )}
                style={{ background: "var(--bi-bad)" }}
              >
                {busyId === confirm.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BiEntryDrawer
        open={drawerOpen}
        entry={editing}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
