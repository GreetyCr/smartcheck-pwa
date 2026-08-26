"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCompactCRC,
  formatCRC,
  formatInt,
  formatMonthLong,
  formatPct,
} from "@/lib/bi-format";
import { BiCard } from "./BiCard";
import { BiCategoryBars } from "./BiCategoryBars";
import {
  ExpenseGroupsCard,
  type ExpenseBreakdown,
  type PeriodoKey,
} from "./ExpenseGroupsCard";
import { BiEntriesTable } from "./BiEntriesTable";
import { BiEntryDrawer } from "./BiEntryDrawer";
import { BiKpiCard } from "./BiKpiCard";
import { BiMonthlyBars } from "./BiMonthlyBars";
import { ConciliacionCard } from "./ConciliacionCard";
import type {
  FinanceEntry,
  FinanceEntryInput,
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
  periodoGastos,
  onPeriodoGastos,
  conciliacion,
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
  periodoGastos?: PeriodoKey;
  onPeriodoGastos?: (p: PeriodoKey) => void;
  /** Conciliación finanzas ↔ revisiones (mitad de RF-05). Si no llega, no se pinta. */
  conciliacion?: Reconciliation;
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
      sheet: "Sheet",
    };
    return (["inspection", "manual", "sheet"] as const)
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

  const delta = (now: number, before: number | undefined) => {
    if (before === undefined || before === 0) return null;
    const pct = ((now - before) / Math.abs(before)) * 100;
    if (Math.abs(pct) < 0.05) return { pct: 0, label: "sin cambio" };
    // Etiqueta corta: con "vs mes anterior" se truncaba en móvil.
    return {
      pct,
      label: `${Math.abs(pct).toFixed(1).replace(".", ",")}% vs anterior`,
    };
  };

  // Desglose de gastos por categoría del periodo visible (calculado sobre los
  // movimientos ya cargados: completo para un mes).
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (e.kind !== "expense") continue;
      map.set(e.category, (map.get(e.category) ?? 0) + e.amountCRC);
    }
    return [...map.entries()]
      .map(([category, amountCRC]) => ({ category, amountCRC }))
      .sort((a, b) => b.amountCRC - a.amountCRC);
  }, [entries]);

  const viaticoTotal = useMemo(
    () =>
      entries.reduce((sum, e) => (e.isViatico ? sum + e.amountCRC : sum), 0),
    [entries],
  );

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
          subtitle="Montos normalizados a colones"
        >
          <BiMonthlyBars
            months={months}
            selected={selectedMonth}
            onSelect={(ym) => onSelectMonth(ym === selectedMonth ? null : ym)}
          />
        </BiCard>

        <BiCard
          title="Gastos por categoría"
          subtitle={
            selectedMonth ? formatMonthLong(selectedMonth) : "Movimientos cargados"
          }
        >
          {loadingEntries ? (
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
            periodo={periodoGastos}
            onPeriodo={onPeriodoGastos}
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
              <span className="bi-num text-xs text-[var(--bi-ink-3)]">
                {sourceFilter === "todos"
                  ? `${formatInt(entries.length)} filas`
                  : `${formatInt(visibleEntries.length)} de ${formatInt(entries.length)} filas`}
              </span>
            )
          }
        >
          {loadingEntries ? (
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
              {formatCRC(confirm.amountCRC)} · {confirm.category}
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
