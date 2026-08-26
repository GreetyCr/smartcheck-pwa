"use client";

import { useState } from "react";
import { FinanceDashboard } from "@/components/bi/FinanceDashboard";

/**
 * Desglose de muestra con las magnitudes REALES de producción (19-ago), porque
 * el punto de esta vista es aprobar el diseño con proporciones de verdad: un
 * grupo que se lleva el 67% se ve muy distinto a seis parejos.
 */
const DESGLOSE_CRUDO = {
    "categorias": [
      "otros",
      "mantenimiento"
    ],
    "totalCRC": 8832334,
    "totalRows": 171,
    "grupos": [
      {
        "grupo": "servicios_profesionales",
        "rows": 47,
        "amountCRC": 6752045,
        "pct": 76.4,
        "etiquetas": [
          {
            "etiqueta": "INCORPORATE",
            "rows": 14,
            "amountCRC": 4607841
          },
          {
            "etiqueta": "JRC",
            "rows": 11,
            "amountCRC": 1203122
          },
          {
            "etiqueta": "CONTADOR",
            "rows": 11,
            "amountCRC": 371866
          },
          {
            "etiqueta": "MANTENIMIENTO CHATBOT",
            "rows": 8,
            "amountCRC": 348360
          },
          {
            "etiqueta": "PRIMER PAGO DASHBOARD",
            "rows": 1,
            "amountCRC": 195856
          },
          {
            "etiqueta": "MANTENIMIENTO DASHBOARD",
            "rows": 2,
            "amountCRC": 25000
          }
        ]
      },
      {
        "grupo": "software",
        "rows": 78,
        "amountCRC": 943299,
        "pct": 10.7,
        "etiquetas": [
          {
            "etiqueta": "SAFETY CULTURE",
            "rows": 13,
            "amountCRC": 192007
          },
          {
            "etiqueta": "OPEN AI",
            "rows": 8,
            "amountCRC": 177020
          },
          {
            "etiqueta": "MANYCHAT",
            "rows": 8,
            "amountCRC": 156680
          },
          {
            "etiqueta": "AIRTABLE",
            "rows": 8,
            "amountCRC": 99180
          },
          {
            "etiqueta": "BASE DATOS APP",
            "rows": 2,
            "amountCRC": 74000
          },
          {
            "etiqueta": "CAPTIONS",
            "rows": 11,
            "amountCRC": 54632
          },
          {
            "etiqueta": "IG VERIFIED",
            "rows": 11,
            "amountCRC": 54632
          },
          {
            "etiqueta": "SERVIDOR CHATBOT",
            "rows": 6,
            "amountCRC": 45378
          },
          {
            "etiqueta": "BASE DATOS APP PWA",
            "rows": 1,
            "amountCRC": 37000
          },
          {
            "etiqueta": "CONTABO",
            "rows": 8,
            "amountCRC": 27770
          },
          {
            "etiqueta": "GPT",
            "rows": 2,
            "amountCRC": 25000
          }
        ]
      },
      {
        "grupo": "equipo",
        "rows": 14,
        "amountCRC": 651692,
        "pct": 7.4,
        "etiquetas": [
          {
            "etiqueta": "EQUIPO",
            "rows": 13,
            "amountCRC": 646692
          },
          {
            "etiqueta": "AHORRO EQUIPO",
            "rows": 1,
            "amountCRC": 5000
          }
        ]
      },
      {
        "grupo": "telefonia",
        "rows": 32,
        "amountCRC": 485298,
        "pct": 5.5,
        "etiquetas": [
          {
            "etiqueta": "CELULAR KOLBI",
            "rows": 14,
            "amountCRC": 269125
          },
          {
            "etiqueta": "CELULAR CLARO",
            "rows": 13,
            "amountCRC": 158673
          },
          {
            "etiqueta": "CELULAR KOLBI TECNICO",
            "rows": 4,
            "amountCRC": 46000
          },
          {
            "etiqueta": "CELULAR TECNICO",
            "rows": 1,
            "amountCRC": 11500
          }
        ]
      }
    ],
    "sinClasificar": []
  };
import type { FinanceEntry, FinanceSummary } from "@/components/bi/types";
import type { PeriodoKey } from "@/components/bi/ExpenseGroupsCard";
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

/**
 * El porcentaje de cada proveedor **dentro de su grupo** se deriva acá en vez
 * de escribirse en la muestra: es una función de dos números que ya están, y
 * copiarlo a mano es la vía más corta a que la vista de revisión enseñe un
 * porcentaje que el servidor nunca calcularía así.
 */
const DESGLOSE_OTROS = {
  ...DESGLOSE_CRUDO,
  grupos: DESGLOSE_CRUDO.grupos.map((g) => ({
    ...g,
    etiquetas: (g.etiquetas ?? []).map((e) => ({
      ...e,
      pctGrupo:
        g.amountCRC > 0 ? Math.round((e.amountCRC / g.amountCRC) * 1000) / 10 : 0,
    })),
  })),
};

const D = (iso: string) => Date.parse(`${iso}T00:00:00-06:00`);

const ENTRIES: FinanceEntry[] = [
  { id: "s11", kind: "income", category: "inspeccion", amountCRC: 59_000, originalAmount: 59_000, originalCurrency: "CRC", date: D("2026-07-26"), yearMonth: "2026-07", isViatico: false, note: "Hyundai Tucson 2021 — al entregar el reporte", source: "inspection", editable: false, createdAt: D("2026-07-26") },
  { id: "s12", kind: "expense", category: "comision", amountCRC: 5_000, originalAmount: 5_000, originalCurrency: "CRC", date: D("2026-07-26"), yearMonth: "2026-07", isViatico: false, note: "Comisión de la venta — Hyundai Tucson 2021", source: "inspection", editable: false, createdAt: D("2026-07-26") },
  { id: "s1", kind: "income", category: "inspeccion", amountCRC: 50_000, originalAmount: 50_000, originalCurrency: "CRC", date: D("2026-07-24"), yearMonth: "2026-07", isViatico: false, note: "Toyota Fortuner 2019", source: "manual", editable: true, createdAt: D("2026-07-24") },
  { id: "s2", kind: "income", category: "inspeccion", amountCRC: 68_850, originalAmount: 135, originalCurrency: "USD", fxRate: 510, date: D("2026-07-22"), yearMonth: "2026-07", isViatico: false, note: "Cliente fuera del GAM", source: "manual", editable: true, createdAt: D("2026-07-22") },
  { id: "s3", kind: "expense", category: "gasolina", amountCRC: 18_500, originalAmount: 18_500, originalCurrency: "CRC", date: D("2026-07-22"), yearMonth: "2026-07", isViatico: true, tecnico: "Técnico 2", localidad: "Alajuela", source: "manual", editable: true, createdAt: D("2026-07-22") },
  { id: "s4", kind: "expense", category: "salario", amountCRC: 850_000, originalAmount: 850_000, originalCurrency: "CRC", date: D("2026-07-20"), yearMonth: "2026-07", isViatico: false, note: "Quincena", source: "sheet", editable: true, createdAt: D("2026-07-20") },
  { id: "s5", kind: "expense", category: "comida", amountCRC: 9_800, originalAmount: 9_800, originalCurrency: "CRC", date: D("2026-07-19"), yearMonth: "2026-07", isViatico: true, tecnico: "Esteban", localidad: "Cartago", source: "manual", editable: true, createdAt: D("2026-07-19") },
  { id: "s6", kind: "income", category: "adicional_gasolina", amountCRC: 12_000, originalAmount: 12_000, originalCurrency: "CRC", date: D("2026-07-18"), yearMonth: "2026-07", isViatico: false, source: "sheet", editable: true, createdAt: D("2026-07-18") },
  { id: "s7", kind: "expense", category: "publicidad", amountCRC: 145_000, originalAmount: 145_000, originalCurrency: "CRC", date: D("2026-07-15"), yearMonth: "2026-07", isViatico: false, note: "Campaña TikTok", source: "sheet", editable: true, createdAt: D("2026-07-15") },
  { id: "s8", kind: "expense", category: "mantenimiento", amountCRC: 62_400, originalAmount: 62_400, originalCurrency: "CRC", date: D("2026-07-12"), yearMonth: "2026-07", isViatico: false, source: "sheet", editable: true, createdAt: D("2026-07-12") },
  { id: "s9", kind: "expense", category: "bonos", amountCRC: 40_000, originalAmount: 40_000, originalCurrency: "CRC", date: D("2026-07-10"), yearMonth: "2026-07", isViatico: true, tecnico: "Técnico 3", source: "manual", editable: true, createdAt: D("2026-07-10") },
  { id: "s10", kind: "expense", category: "seguro", amountCRC: 78_000, originalAmount: 78_000, originalCurrency: "CRC", date: D("2026-07-05"), yearMonth: "2026-07", isViatico: false, source: "sheet", editable: true, createdAt: D("2026-07-05") },
];

export function FinanzasPreview() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>("2026-07");
  /* El filtro cambia de pestaña pero NO refiltra: la muestra es estática. Se
     incluye para poder aprobar el control, no para simular la consulta. */
  const [periodo, setPeriodo] = useState<PeriodoKey>("todo");

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
          expenseBreakdown={DESGLOSE_OTROS}
          periodoGastos={periodo}
          onPeriodoGastos={setPeriodo}
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
