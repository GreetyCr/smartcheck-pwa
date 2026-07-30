"use client";

import { useState } from "react";
import { FinanceDashboard } from "@/components/bi/FinanceDashboard";
import type { FinanceEntry, FinanceSummary } from "@/components/bi/types";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Datos de MUESTRA (no salen de Convex) con magnitudes parecidas a las reales
 * para juzgar el diseño con volúmenes creíbles. Fechas fijas: la vista debe
 * verse igual en cada carga.
 */
const MONTHS: FinanceSummary["months"] = [
  { yearMonth: "2026-01", rows: 38, income: 3_180_000, expense: 1_940_500, utilidad: 1_239_500, marginPct: 38.98 },
  { yearMonth: "2026-02", rows: 41, income: 3_640_000, expense: 2_120_800, utilidad: 1_519_200, marginPct: 41.74 },
  { yearMonth: "2026-03", rows: 35, income: 2_910_000, expense: 2_305_400, utilidad: 604_600, marginPct: 20.78 },
  { yearMonth: "2026-04", rows: 44, income: 4_120_000, expense: 2_260_100, utilidad: 1_859_900, marginPct: 45.14 },
  { yearMonth: "2026-05", rows: 47, income: 4_385_000, expense: 2_480_600, utilidad: 1_904_400, marginPct: 43.43 },
  { yearMonth: "2026-06", rows: 45, income: 5_396_633, expense: 2_636_670, utilidad: 2_759_963, marginPct: 51.14 },
  { yearMonth: "2026-07", rows: 39, income: 3_747_000, expense: 2_636_670, utilidad: 1_110_330, marginPct: 29.63 },
];

const SUMMARY: FinanceSummary = {
  months: MONTHS,
  totals: {
    rows: 505,
    income: 45_704_410,
    expense: 28_005_909,
    utilidad: 17_698_501,
    marginPct: 38.72,
    viaticoCount: 97,
    viaticoAmountCRC: 3_202_985,
  },
};

const D = (iso: string) => Date.parse(`${iso}T00:00:00-06:00`);

const ENTRIES: FinanceEntry[] = [
  { id: "s1", kind: "income", category: "inspeccion", amountCRC: 50_000, originalAmount: 50_000, originalCurrency: "CRC", date: D("2026-07-24"), yearMonth: "2026-07", isViatico: false, note: "Toyota Fortuner 2019", source: "manual", createdAt: D("2026-07-24") },
  { id: "s2", kind: "income", category: "inspeccion", amountCRC: 68_850, originalAmount: 135, originalCurrency: "USD", fxRate: 510, date: D("2026-07-22"), yearMonth: "2026-07", isViatico: false, note: "Cliente fuera del GAM", source: "manual", createdAt: D("2026-07-22") },
  { id: "s3", kind: "expense", category: "gasolina", amountCRC: 18_500, originalAmount: 18_500, originalCurrency: "CRC", date: D("2026-07-22"), yearMonth: "2026-07", isViatico: true, tecnico: "Técnico 2", localidad: "Alajuela", source: "manual", createdAt: D("2026-07-22") },
  { id: "s4", kind: "expense", category: "salario", amountCRC: 850_000, originalAmount: 850_000, originalCurrency: "CRC", date: D("2026-07-20"), yearMonth: "2026-07", isViatico: false, note: "Quincena", source: "sheet", createdAt: D("2026-07-20") },
  { id: "s5", kind: "expense", category: "comida", amountCRC: 9_800, originalAmount: 9_800, originalCurrency: "CRC", date: D("2026-07-19"), yearMonth: "2026-07", isViatico: true, tecnico: "Esteban", localidad: "Cartago", source: "manual", createdAt: D("2026-07-19") },
  { id: "s6", kind: "income", category: "adicional_gasolina", amountCRC: 12_000, originalAmount: 12_000, originalCurrency: "CRC", date: D("2026-07-18"), yearMonth: "2026-07", isViatico: false, source: "sheet", createdAt: D("2026-07-18") },
  { id: "s7", kind: "expense", category: "publicidad", amountCRC: 145_000, originalAmount: 145_000, originalCurrency: "CRC", date: D("2026-07-15"), yearMonth: "2026-07", isViatico: false, note: "Campaña TikTok", source: "sheet", createdAt: D("2026-07-15") },
  { id: "s8", kind: "expense", category: "mantenimiento", amountCRC: 62_400, originalAmount: 62_400, originalCurrency: "CRC", date: D("2026-07-12"), yearMonth: "2026-07", isViatico: false, source: "sheet", createdAt: D("2026-07-12") },
  { id: "s9", kind: "expense", category: "bonos", amountCRC: 40_000, originalAmount: 40_000, originalCurrency: "CRC", date: D("2026-07-10"), yearMonth: "2026-07", isViatico: true, tecnico: "Técnico 3", source: "manual", createdAt: D("2026-07-10") },
  { id: "s10", kind: "expense", category: "seguro", amountCRC: 78_000, originalAmount: 78_000, originalCurrency: "CRC", date: D("2026-07-05"), yearMonth: "2026-07", isViatico: false, source: "sheet", createdAt: D("2026-07-05") },
];

export function FinanzasPreview() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>("2026-07");

  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — datos de muestra, acciones de
        escritura desactivadas. No existe en producción.
      </div>
      {/* Acá no hay shell de /admin, así que este envoltorio hace su papel:
          aplica el tema grafito y el mismo padding de contenido. Sin él el
          tablero se vería sobre fondo claro y sin tokens. */}
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        {/* Interactivo a propósito: el formulario y el diálogo de borrado también
            se revisan. Los handlers rechazan con un mensaje claro en vez de
            simular un guardado que no ocurre. */}
        <FinanceDashboard
          summary={SUMMARY}
          entries={ENTRIES}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          onSubmitEntry={async () => {
            throw new Error(
              "Vista de muestra: los cambios no se guardan. Usá /admin/finanzas.",
            );
          }}
          onDeleteEntry={async () => {
            throw new Error(
              "Vista de muestra: los cambios no se guardan. Usá /admin/finanzas.",
            );
          }}
        />
      </div>
    </>
  );
}
