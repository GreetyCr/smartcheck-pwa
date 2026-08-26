"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FinanceDashboard } from "@/components/bi/FinanceDashboard";
import { rangoDelPeriodo, type PeriodoKey } from "@/components/bi/ExpenseGroupsCard";
import {
  FiltrosGlobales,
  useFiltrosBi,
} from "@/components/bi/FiltrosGlobales";

/**
 * Finanzas solo entiende de **periodo**.
 *
 * Un gasto no tiene provincia, ni marca, ni tipo de motor: son movimientos de
 * la contabilidad, no revisiones. Las otras siete dimensiones de la barra se
 * pintan apagadas acá — que es la única alternativa honesta a aceptarlas y no
 * aplicarlas (A64).
 */
const SOPORTA = ["periodo"] as const;
import type { FinanceEntry, FinanceEntryInput } from "@/components/bi/types";

/**
 * Tablero de Finanzas (F5/F6) — lee `bi/public:financeSummary` y
 * `bi/financeForm:listFinanceEntries`, escribe con las mutations de captura
 * manual. Todas esas funciones exigen rol admin en el backend (`requireAdmin`);
 * el layout de `/admin` además cierra la UI a no-admins.
 */
export default function FinanzasPage() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  /** Periodo del desglose de gastos. Es SUYO y no del tablero: acá la pregunta
      es «¿cambió el reparto?», que se contesta con meses, no con un mes. */
  const [periodo, setPeriodo] = useState<PeriodoKey>("todo");

  const { args: rangoGlobal } = useFiltrosBi(SOPORTA);
  const summary = useQuery(api.bi.public.financeSummary, rangoGlobal);
  /* La conciliación va SIN el periodo global, y es la única excepción: su
     gracia es la serie completa mes a mes, y acotarla escondería justo los
     meses que se salen del margen. */
  const conciliacion = useQuery(api.bi.public.reconciliation, {});
  /* El desglose de «Otros» va aparte del bloqueo de carga: es un zoom sobre
     una barra, no una cifra que tenga que cuadrar con las demás. */
  const breakdown = useQuery(api.bi.public.expenseBreakdown, rangoDelPeriodo(periodo));
  const entries = useQuery(
    api.bi.financeForm.listFinanceEntries,
    selectedMonth ? { yearMonth: selectedMonth, limit: 500 } : { limit: 200 },
  );

  const createEntry = useMutation(api.bi.financeForm.createFinanceEntry);
  const updateEntry = useMutation(api.bi.financeForm.updateFinanceEntry);
  const deleteEntry = useMutation(api.bi.financeForm.deleteFinanceEntry);

  const rows = useMemo<FinanceEntry[]>(
    () => (entries ?? []) as FinanceEntry[],
    [entries],
  );

  if (summary === undefined) {
    return (
      // El fondo grafito lo pone el shell; acá solo va el esqueleto.
      <div>
        <div className="bi-skeleton h-9 w-48 rounded-lg" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bi-skeleton h-[110px] rounded-2xl" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.9fr_1fr]">
          <div className="bi-skeleton h-[320px] rounded-2xl" />
          <div className="bi-skeleton h-[320px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <FiltrosGlobales soporta={SOPORTA} />
    <FinanceDashboard
      summary={summary}
      entries={rows}
      expenseBreakdown={breakdown ?? undefined}
      conciliacion={conciliacion ?? undefined}
      periodoGastos={periodo}
      onPeriodoGastos={setPeriodo}
      loadingEntries={entries === undefined}
      selectedMonth={selectedMonth}
      onSelectMonth={setSelectedMonth}
      onSubmitEntry={async (input: FinanceEntryInput, id?: string) => {
        if (id) {
          await updateEntry({
            id: id as Id<"finance_entries">,
            ...input,
          });
        } else {
          await createEntry(input);
        }
      }}
      onDeleteEntry={async (id: string) => {
        await deleteEntry({ id: id as Id<"finance_entries"> });
      }}
      />
    </div>
  );
}
