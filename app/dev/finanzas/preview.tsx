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
import type {
  ContrasteHoja,
  FinanceEntry,
  FinanceSummary,
  Reconciliation,
} from "@/components/bi/types";
import type { PeriodoKey } from "@/components/bi/ExpenseGroupsCard";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Datos de MUESTRA (no salen de Convex) con magnitudes parecidas a las reales
 * para juzgar el diseño con volúmenes creíbles. Fechas fijas: la vista debe
 * verse igual en cada carga.
 */
const MONTHS: FinanceSummary["months"] = [
  { yearMonth: "2025-07", rows: 40, income: 4_011_000, expense: 1_927_710, utilidad: 2_083_290, marginPct: 51.94, viaticoAmountCRC: 282_000, porCategoria: [{ category: "salario", amountCRC: 644_000, rows: 9 }, { category: "publicidad", amountCRC: 481_510, rows: 6 }, { category: "otros", amountCRC: 475_200, rows: 7 }, { category: "gasolina", amountCRC: 282_000, rows: 8 }, { category: "seguro", amountCRC: 45_000, rows: 1 }] },
  { yearMonth: "2025-08", rows: 33, income: 2_219_373, expense: 1_517_100, utilidad: 702_273, marginPct: 31.64, viaticoAmountCRC: 132_700, porCategoria: [{ category: "otros", amountCRC: 475_200, rows: 7 }, { category: "publicidad", amountCRC: 470_200, rows: 5 }, { category: "salario", amountCRC: 394_000, rows: 7 }, { category: "gasolina", amountCRC: 120_700, rows: 5 }, { category: "seguro", amountCRC: 45_000, rows: 1 }, { category: "comida", amountCRC: 12_000, rows: 1 }] },
  { yearMonth: "2025-09", rows: 40, income: 3_673_650, expense: 1_977_539, utilidad: 1_696_111, marginPct: 46.17, viaticoAmountCRC: 295_008, porCategoria: [{ category: "otros", amountCRC: 614_636, rows: 7 }, { category: "salario", amountCRC: 596_239, rows: 9 }, { category: "publicidad", amountCRC: 426_314, rows: 6 }, { category: "gasolina", amountCRC: 279_177, rows: 9 }, { category: "seguro", amountCRC: 45_342, rows: 1 }, { category: "comida", amountCRC: 15_831, rows: 1 }] },
  { yearMonth: "2025-10", rows: 35, income: 2_448_215, expense: 1_645_709, utilidad: 802_506, marginPct: 32.78, viaticoAmountCRC: 162_331, porCategoria: [{ category: "otros", amountCRC: 647_283, rows: 10 }, { category: "salario", amountCRC: 402_022, rows: 4 }, { category: "publicidad", amountCRC: 388_914, rows: 5 }, { category: "gasolina", amountCRC: 149_743, rows: 7 }, { category: "seguro", amountCRC: 45_159, rows: 1 }, { category: "comida", amountCRC: 12_588, rows: 1 }] },
  { yearMonth: "2025-11", rows: 34, income: 3_328_975, expense: 1_648_420, utilidad: 1_680_555, marginPct: 50.48, viaticoAmountCRC: 160_407, porCategoria: [{ category: "otros", amountCRC: 641_893, rows: 10 }, { category: "salario", amountCRC: 408_549, rows: 5 }, { category: "publicidad", amountCRC: 392_788, rows: 5 }, { category: "gasolina", amountCRC: 152_868, rows: 7 }, { category: "seguro", amountCRC: 44_783, rows: 1 }, { category: "comida", amountCRC: 7_539, rows: 1 }] },
  { yearMonth: "2025-12", rows: 23, income: 1_431_537, expense: 1_445_833, utilidad: -14_296, marginPct: -1, viaticoAmountCRC: 76_095, porCategoria: [{ category: "otros", amountCRC: 660_948, rows: 10 }, { category: "publicidad", amountCRC: 368_276, rows: 4 }, { category: "salario", amountCRC: 295_822, rows: 3 }, { category: "gasolina", amountCRC: 76_095, rows: 3 }, { category: "seguro", amountCRC: 44_692, rows: 1 }] },
  { yearMonth: "2026-01", rows: 41, income: 3_913_872, expense: 2_003_327, utilidad: 1_910_545, marginPct: 48.81, viaticoAmountCRC: 245_529, porCategoria: [{ category: "otros", amountCRC: 642_671, rows: 13 }, { category: "publicidad", amountCRC: 460_051, rows: 5 }, { category: "salario", amountCRC: 426_792, rows: 1 }, { category: "impuestos", amountCRC: 158_806, rows: 1 }, { category: "gasolina", amountCRC: 123_340, rows: 4 }, { category: "bonos", amountCRC: 122_189, rows: 4 }, { category: "seguro", amountCRC: 44_664, rows: 1 }, { category: "mantenimiento", amountCRC: 24_814, rows: 1 }] },
  { yearMonth: "2026-02", rows: 41, income: 3_737_538, expense: 1_791_344, utilidad: 1_946_194, marginPct: 52.07, viaticoAmountCRC: 145_042, porCategoria: [{ category: "otros", amountCRC: 634_787, rows: 13 }, { category: "publicidad", amountCRC: 458_195, rows: 5 }, { category: "salario", amountCRC: 404_983, rows: 1 }, { category: "gasolina", amountCRC: 98_892, rows: 4 }, { category: "bonos", amountCRC: 46_150, rows: 3 }, { category: "seguro", amountCRC: 42_382, rows: 1 }, { category: "impuestos", amountCRC: 42_382, rows: 1 }, { category: "comision", amountCRC: 40_027, rows: 2 }, { category: "mantenimiento", amountCRC: 23_546, rows: 1 }] },
  { yearMonth: "2026-03", rows: 43, income: 3_227_500, expense: 2_786_017, utilidad: 441_483, marginPct: 13.68, viaticoAmountCRC: 328_383, porCategoria: [{ category: "salario", amountCRC: 1_138_756, rows: 6 }, { category: "otros", amountCRC: 674_000, rows: 13 }, { category: "publicidad", amountCRC: 459_878, rows: 5 }, { category: "gasolina", amountCRC: 313_833, rows: 5 }, { category: "comision", amountCRC: 86_000, rows: 2 }, { category: "mantenimiento", amountCRC: 50_000, rows: 1 }, { category: "seguro", amountCRC: 49_000, rows: 2 }, { category: "bonos", amountCRC: 14_550, rows: 2 }] },
  { yearMonth: "2026-04", rows: 48, income: 3_971_750, expense: 3_072_113, utilidad: 899_637, marginPct: 22.65, viaticoAmountCRC: 159_500, porCategoria: [{ category: "salario", amountCRC: 1_114_166, rows: 7 }, { category: "otros", amountCRC: 685_500, rows: 14 }, { category: "publicidad", amountCRC: 485_957, rows: 5 }, { category: "impuestos", amountCRC: 483_990, rows: 1 }, { category: "gasolina", amountCRC: 106_000, rows: 4 }, { category: "bonos", amountCRC: 53_500, rows: 5 }, { category: "seguro", amountCRC: 53_000, rows: 2 }, { category: "mantenimiento", amountCRC: 50_000, rows: 1 }, { category: "comision", amountCRC: 40_000, rows: 1 }] },
  { yearMonth: "2026-05", rows: 43, income: 4_376_000, expense: 2_676_086, utilidad: 1_699_914, marginPct: 38.85, viaticoAmountCRC: 140_000, porCategoria: [{ category: "salario", amountCRC: 1_116_641, rows: 7 }, { category: "otros", amountCRC: 701_500, rows: 14 }, { category: "publicidad", amountCRC: 474_045, rows: 5 }, { category: "gasolina", amountCRC: 130_000, rows: 4 }, { category: "impuestos", amountCRC: 91_000, rows: 1 }, { category: "seguro", amountCRC: 53_000, rows: 2 }, { category: "mantenimiento", amountCRC: 50_000, rows: 1 }, { category: "comision", amountCRC: 49_900, rows: 1 }, { category: "bonos", amountCRC: 10_000, rows: 1 }] },
  { yearMonth: "2026-06", rows: 45, income: 5_618_000, expense: 2_858_037, utilidad: 2_759_963, marginPct: 49.13, viaticoAmountCRC: 132_000, porCategoria: [{ category: "salario", amountCRC: 1_496_037, rows: 7 }, { category: "otros", amountCRC: 578_500, rows: 14 }, { category: "publicidad", amountCRC: 301_000, rows: 4 }, { category: "impuestos", amountCRC: 130_000, rows: 1 }, { category: "gasolina", amountCRC: 110_000, rows: 4 }, { category: "comision", amountCRC: 87_500, rows: 1 }, { category: "seguro", amountCRC: 83_000, rows: 2 }, { category: "mantenimiento", amountCRC: 50_000, rows: 1 }, { category: "bonos", amountCRC: 22_000, rows: 4 }] },
  { yearMonth: "2026-07", rows: 46, income: 4_546_000, expense: 3_035_269, utilidad: 1_510_731, marginPct: 33.23, viaticoAmountCRC: 143_000, porCategoria: [{ category: "salario", amountCRC: 1_492_413, rows: 7 }, { category: "otros", amountCRC: 779_356, rows: 16 }, { category: "publicidad", amountCRC: 272_000, rows: 4 }, { category: "impuestos", amountCRC: 130_000, rows: 1 }, { category: "gasolina", amountCRC: 110_000, rows: 4 }, { category: "seguro", amountCRC: 83_000, rows: 2 }, { category: "comision", amountCRC: 73_000, rows: 1 }, { category: "mantenimiento", amountCRC: 62_500, rows: 2 }, { category: "bonos", amountCRC: 33_000, rows: 4 }] },
  { yearMonth: "2026-08", rows: 138, income: 5_557_000, expense: 2_994_835, utilidad: 2_562_165, marginPct: 46.11, viaticoAmountCRC: 169_000, porCategoria: [{ category: "salario", amountCRC: 1_726_076, rows: 9 }, { category: "impuestos", amountCRC: 402_109, rows: 3 }, { category: "otros", amountCRC: 353_500, rows: 18 }, { category: "gasolina", amountCRC: 181_000, rows: 6 }, { category: "comision", amountCRC: 103_600, rows: 4 }, { category: "comida", amountCRC: 83_350, rows: 6 }, { category: "seguro", amountCRC: 75_000, rows: 1 }, { category: "publicidad", amountCRC: 70_200, rows: 1 }] },
  { yearMonth: "2026-09", rows: 13, income: 849_000, expense: 0, utilidad: 849_000, marginPct: 100, viaticoAmountCRC: 0, porCategoria: [] },
];

/**
 * Respuesta **literal** de `bi/metrics:financeSummary` en producción, **6-set-2026**.
 *
 * Antes esta muestra venía del 25-ago y las demás páginas de `/dev` de otras
 * fechas: el QA de usuario cero comparó pantallas y concluyó que el panel se
 * contradecía. **En producción los números cuadran** — lo que no cuadraba eran
 * las muestras entre sí (A153).
 *
 * `porCategoria` es lo que arregla A153: el reparto del gasto ahora lo suma el
 * servidor sobre TODAS las filas, no el cliente sobre las 200 que alcanzó a
 * pedir. Su suma es exactamente `totals.expense`.
 */
const SUMMARY: FinanceSummary = {
  months: MONTHS,
  totals: {
    rows: 663,
    income: 52_909_410,
    expense: 31_379_339,
    utilidad: 21_530_071,
    marginPct: 40.69,
    viaticoCount: 100,
    viaticoAmountCRC: 2_570_995,
  },
  porCategoria: [
    { category: "salario", amountCRC: 11_656_496, rows: 82 },
    { category: "otros", amountCRC: 8_564_974, rows: 166 },
    { category: "publicidad", amountCRC: 5_509_328, rows: 65 },
    { category: "gasolina", amountCRC: 2_233_648, rows: 74 },
    { category: "impuestos", amountCRC: 1_438_287, rows: 9 },
    { category: "seguro", amountCRC: 753_022, rows: 19 },
    { category: "comision", amountCRC: 480_027, rows: 12 },
    { category: "mantenimiento", amountCRC: 310_860, rows: 8 },
    { category: "bonos", amountCRC: 301_389, rows: 23 },
    { category: "comida", amountCRC: 131_308, rows: 10 },
  ],
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

/* -------------------------------------------------------------------------- */
/* Conciliación — respuesta LITERAL de producción, 25-ago-2026                 */
/* -------------------------------------------------------------------------- */

/**
 * No inventado: es lo que devuelve la query en PROD. Se pega tal cual por la
 * misma razón de siempre (A95) —una muestra escrita a mano ya nos mostró una
 * vez la tasa de agosto con la nota de julio— y porque los casos reales son
 * justo los que ponen a prueba el diseño: un mes con **+49,3%**, dos con gap
 * **negativo** (que es la dirección preocupante) y el mes en curso, que además
 * es el único con captura automática.
 *
 * Regenerar con:  npx convex run --prod bi/metrics:reconciliation '{}'
 */
const CONCILIACION: Reconciliation = {
  months: [
    { yearMonth: "2025-07", inspectionsIncome: 3_651_000, inspectionsCount: 74, financeIncome: 4_011_000, gapAbs: 360_000, gapPct: 8.98, significant: true, enCurso: false, autoCaptura: false },
    { yearMonth: "2025-08", inspectionsIncome: 2_086_162, inspectionsCount: 41, financeIncome: 2_219_373, gapAbs: 133_211, gapPct: 6, significant: true, enCurso: false, autoCaptura: false },
    { yearMonth: "2025-09", inspectionsIncome: 1_860_910, inspectionsCount: 31, financeIncome: 3_673_650, gapAbs: 1_812_740, gapPct: 49.34, significant: true, enCurso: false, autoCaptura: false },
    { yearMonth: "2025-10", inspectionsIncome: 2_335_014, inspectionsCount: 36, financeIncome: 2_448_215, gapAbs: 113_201, gapPct: 4.62, significant: false, enCurso: false, autoCaptura: false },
    { yearMonth: "2025-11", inspectionsIncome: 2_957_919, inspectionsCount: 47, financeIncome: 3_328_975, gapAbs: 371_056, gapPct: 11.15, significant: true, enCurso: false, autoCaptura: false },
    { yearMonth: "2025-12", inspectionsIncome: 1_427_692, inspectionsCount: 23, financeIncome: 1_431_537, gapAbs: 3_845, gapPct: 0.27, significant: false, enCurso: false, autoCaptura: false },
    { yearMonth: "2026-01", inspectionsIncome: 3_178_412, inspectionsCount: 51, financeIncome: 3_913_872, gapAbs: 735_460, gapPct: 18.79, significant: true, enCurso: false, autoCaptura: false },
    { yearMonth: "2026-02", inspectionsIncome: 2_776_817, inspectionsCount: 45, financeIncome: 3_737_538, gapAbs: 960_721, gapPct: 25.7, significant: true, enCurso: false, autoCaptura: false },
    { yearMonth: "2026-03", inspectionsIncome: 3_422_600, inspectionsCount: 53, financeIncome: 3_227_500, gapAbs: -195_100, gapPct: -6.04, significant: true, enCurso: false, autoCaptura: false },
    { yearMonth: "2026-04", inspectionsIncome: 3_163_000, inspectionsCount: 50, financeIncome: 3_971_750, gapAbs: 808_750, gapPct: 20.36, significant: true, enCurso: false, autoCaptura: false },
    { yearMonth: "2026-05", inspectionsIncome: 4_130_617, inspectionsCount: 64, financeIncome: 4_376_000, gapAbs: 245_383, gapPct: 5.61, significant: true, enCurso: false, autoCaptura: false },
    { yearMonth: "2026-06", inspectionsIncome: 5_515_000, inspectionsCount: 85, financeIncome: 5_618_000, gapAbs: 103_000, gapPct: 1.83, significant: false, enCurso: false, autoCaptura: false },
    { yearMonth: "2026-07", inspectionsIncome: 4_937_141, inspectionsCount: 76, financeIncome: 4_546_000, gapAbs: -391_141, gapPct: -8.6, significant: true, enCurso: false, autoCaptura: false },
    { yearMonth: "2026-08", inspectionsIncome: 4_519_000, inspectionsCount: 72, financeIncome: 4_591_000, gapAbs: 72_000, gapPct: 1.57, significant: false, enCurso: true, autoCaptura: true, sinEntregar: 1 },
  ],
  totals: {
    inspectionsIncome: 45_961_284,
    financeIncome: 51_094_410,
    gapAbs: 5_133_126,
    gapPct: 10.05,
    significant: true,
    gapAbsMesesCerrados: 5_061_126,
    gapPctMesesCerrados: 10.88,
  },
  thresholdPct: 5,
  financeStartISO: "2025-07-01",
  primerMesAutoCaptura: "2026-08",
  note: "Ver `reconciliationImpl` en convex/bi/metrics.ts.",
};

/* -------------------------------------------------------------------------- */
/* Contraste hoja ↔ panel — respuesta LITERAL de producción, 26-ago-2026       */
/* -------------------------------------------------------------------------- */

/**
 * Los 13 meses cuadran; la única diferencia es la corrección de marzo que
 * Esteban autorizó (B37) y que la hoja no tiene. Lo que sí trae son **tres
 * puntos donde la hoja no cuadra consigo misma**, que es lo que esta tarjeta
 * tiene que saber mostrar sin culpar al panel.
 *
 * Regenerar con:  npx convex run --prod bi/contraste:contraste \'{}\'
 */
const CONTRASTE: ContrasteHoja = {
  "conDiferencia": 0,
  "conExplicacion": 1,
  "corridaAt": 1787727188887,
  "estado": "ok",
  "hojaNoCuadra": [
    {
      "campo": "ingresos",
      "diferencia": 941000,
      "filas": 4011000,
      "moneda": "CRC",
      "total": 3070000,
      "yearMonth": "2025-07"
    },
    {
      "campo": "gastos",
      "diferencia": -308510,
      "filas": 1927710,
      "moneda": "CRC",
      "total": 2236220,
      "yearMonth": "2025-07"
    },
    {
      "campo": "gastos",
      "diferencia": -2680,
      "filas": 2921,
      "moneda": "USD",
      "total": 5601,
      "yearMonth": "2025-12"
    }
  ],
  "mensaje": "13 meses contrastados, todos cuadran",
  "meses": [
    {
      "convexFilas": 40,
      "convexGasto": 1927710,
      "convexIngreso": 4011000,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": -308510,
      "difTotalIngreso": 941000,
      "explicacion": null,
      "hojaFilas": 40,
      "hojaGasto": 1927710,
      "hojaIngreso": 4011000,
      "moneda": "CRC",
      "significativo": false,
      "totalGasto": 2236220,
      "totalIngreso": 3070000,
      "yearMonth": "2025-07"
    },
    {
      "convexFilas": 33,
      "convexGasto": 1517100,
      "convexIngreso": 2219373,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 33,
      "hojaGasto": 1517100,
      "hojaIngreso": 2219373,
      "moneda": "CRC",
      "significativo": false,
      "totalGasto": 1517100,
      "totalIngreso": 2219373,
      "yearMonth": "2025-08"
    },
    {
      "convexFilas": 40,
      "convexGasto": 3922.66,
      "convexIngreso": 7282.79,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 40,
      "hojaGasto": 3922.66,
      "hojaIngreso": 7282.79,
      "moneda": "USD",
      "significativo": false,
      "totalGasto": 3922.66,
      "totalIngreso": 7282.79,
      "yearMonth": "2025-09"
    },
    {
      "convexFilas": 35,
      "convexGasto": 3277.35,
      "convexIngreso": 4873,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 35,
      "hojaGasto": 3277.35,
      "hojaIngreso": 4873,
      "moneda": "USD",
      "significativo": false,
      "totalGasto": 3277.35,
      "totalIngreso": 4873,
      "yearMonth": "2025-10"
    },
    {
      "convexFilas": 34,
      "convexGasto": 3301,
      "convexIngreso": 6643,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 34,
      "hojaGasto": 3301,
      "hojaIngreso": 6643,
      "moneda": "USD",
      "significativo": false,
      "totalGasto": 3301,
      "totalIngreso": 6643,
      "yearMonth": "2025-11"
    },
    {
      "convexFilas": 23,
      "convexGasto": 2921,
      "convexIngreso": 2916,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": -2680,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 23,
      "hojaGasto": 2921,
      "hojaIngreso": 2916,
      "moneda": "USD",
      "significativo": false,
      "totalGasto": 5601,
      "totalIngreso": 2916,
      "yearMonth": "2025-12"
    },
    {
      "convexFilas": 41,
      "convexGasto": 4037,
      "convexIngreso": 7918,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 41,
      "hojaGasto": 4037,
      "hojaIngreso": 7918,
      "moneda": "USD",
      "significativo": false,
      "totalGasto": 4037,
      "totalIngreso": 7918,
      "yearMonth": "2026-01"
    },
    {
      "convexFilas": 41,
      "convexGasto": 3804,
      "convexIngreso": 7686.25,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 41,
      "hojaGasto": 3804,
      "hojaIngreso": 7686.25,
      "moneda": "USD",
      "significativo": false,
      "totalGasto": 3804,
      "totalIngreso": 7686.25,
      "yearMonth": "2026-02"
    },
    {
      "convexFilas": 43,
      "convexGasto": 2786017,
      "convexIngreso": 3227500,
      "difGasto": -20004,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": "Corrección autorizada por Esteban el 24-ago (B37/A97): marzo llevaba las cargas sociales completas y solo correspondía el aporte patronal. La hoja conserva el valor viejo.",
      "hojaFilas": 43,
      "hojaGasto": 2806021,
      "hojaIngreso": 3227500,
      "moneda": "CRC",
      "significativo": false,
      "totalGasto": 2806021,
      "totalIngreso": 3227500,
      "yearMonth": "2026-03"
    },
    {
      "convexFilas": 48,
      "convexGasto": 3072113.03,
      "convexIngreso": 3971750,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 48,
      "hojaGasto": 3072113.03,
      "hojaIngreso": 3971750,
      "moneda": "CRC",
      "significativo": false,
      "totalGasto": 3072113.03,
      "totalIngreso": 3971750,
      "yearMonth": "2026-04"
    },
    {
      "convexFilas": 43,
      "convexGasto": 2676085.04,
      "convexIngreso": 4376000,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 43,
      "hojaGasto": 2676085.04,
      "hojaIngreso": 4376000,
      "moneda": "CRC",
      "significativo": false,
      "totalGasto": 2676085.04,
      "totalIngreso": 4376000,
      "yearMonth": "2026-05"
    },
    {
      "convexFilas": 45,
      "convexGasto": 2858036.28,
      "convexIngreso": 5618000,
      "difGasto": 0,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 45,
      "hojaGasto": 2858036.28,
      "hojaIngreso": 5618000,
      "moneda": "CRC",
      "significativo": false,
      "totalGasto": 2858036.28,
      "totalIngreso": 5618000,
      "yearMonth": "2026-06"
    },
    {
      "convexFilas": 46,
      "convexGasto": 3035269,
      "convexIngreso": 4546000,
      "difGasto": -0.13,
      "difIngreso": 0,
      "difTotalGasto": 0,
      "difTotalIngreso": 0,
      "explicacion": null,
      "hojaFilas": 46,
      "hojaGasto": 3035269.13,
      "hojaIngreso": 4546000,
      "moneda": "CRC",
      "significativo": false,
      "totalGasto": 3035269.13,
      "totalIngreso": 4546000,
      "yearMonth": "2026-07"
    }
  ],
  "nota": "Se compara en MONEDA ORIGINAL (la hoja está en $ de sep-2025 a feb-2026) para que el tipo de cambio no entre en la cuenta. «Convex» son solo las filas con source:sheet — lo capturado por la app o a mano no viene de la hoja y no debería cuadrar con ella. La comparación titular es contra las FILAS de la hoja, no contra su celda TOTAL: esa celda se equivoca en dos meses.",
  "tolerancia": 1
};

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
          expenseBreakdown={DESGLOSE_OTROS}
          conciliacion={CONCILIACION}
          contrasteHoja={CONTRASTE}
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
