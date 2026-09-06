"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FinanceDashboard } from "@/components/bi/FinanceDashboard";
import { rangoDelMes } from "@/components/bi/ExpenseGroupsCard";
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

  const { args: rangoGlobal } = useFiltrosBi(SOPORTA);
  const summary = useQuery(api.bi.public.financeSummary, rangoGlobal);
  /* La conciliación va SIN el periodo global, y es la única excepción: su
     gracia es la serie completa mes a mes, y acotarla escondería justo los
     meses que se salen del margen. */
  const conciliacion = useQuery(api.bi.public.reconciliation, {});
  /* El contraste tampoco se filtra: su gracia es cubrir TODOS los meses que
     vinieron de la hoja, y recortar el periodo escondería justo el que cambió. */
  const contrasteHoja = useQuery(api.bi.public.contrasteHoja, {});
  /**
   * **El desglose de «Otros» sigue al mismo periodo que el resto — A158.**
   *
   * Tenía **su propio** control con las cuatro opciones **idénticas** a las de
   * la barra de arriba (Todo · 12 · 6 · 3), gobernando solo esta tarjeta.
   * Esteban usó la de arriba —lo razonable, porque mueve todo lo demás— y la
   * tarjeta no se movió. No se confundió él: la pantalla tenía **dos controles
   * iguales con alcances distintos**.
   *
   * Y si hay un mes elegido en el gráfico, manda el mes. Eso es lo que él pedía
   * —«¿cómo lo veo por mes?»— y la interacción ya existía: clicar una barra ya
   * recortaba la lista de movimientos y «Gastos por categoría», pero **no**
   * ésta, así que clicar julio cambiaba una tarjeta y dejaba la otra igual.
   *
   * Neto: **un control menos** y las tres tarjetas de gasto contando lo mismo.
   */
  const breakdown = useQuery(
    api.bi.public.expenseBreakdown,
    selectedMonth ? rangoDelMes(selectedMonth) : rangoGlobal,
  );
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
      contrasteHoja={contrasteHoja ?? undefined}
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
