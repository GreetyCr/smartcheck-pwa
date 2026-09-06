"use client";

import { useState } from "react";
import {
  AdminDashboard,
  type AdminMetrics,
} from "@/components/admin/AdminDashboard";
import { ResumenEjecutivo } from "@/components/bi/ResumenEjecutivo";
import type { PeriodoKey } from "@/components/bi/ExpenseGroupsCard";
import type {
  ChannelMixRow,
  ExecutiveSummary,
  FinanceMonth,
} from "@/components/bi/types";
import { DevAdminShell } from "./shell";

/**
 * Datos de MUESTRA (no salen de Convex) con magnitudes creíbles para juzgar el
 * diseño. Fijos: la vista debe verse igual en cada carga.
 *
 * El tipo es el de la query real (`AdminMetrics`), así que si el backend cambia
 * de forma esta muestra deja de compilar en vez de mentir.
 */
/**
 * **Identidades inventadas, totales reales — y los totales importan.**
 *
 * `admin:getDashboardMetrics` exige sesión de admin y trae nombres de técnicos,
 * así que esta muestra no se puede regenerar desde producción y sus personas
 * son inventadas a propósito. **Pero sus totales tienen que cuadrar con los de
 * verdad**, porque el bloque de arriba de esta misma pantalla sí sale de
 * producción: hasta el 6-set decía «912 revisiones» arriba y «el total del
 * histórico —887» quince centímetros más abajo. **En una sola captura**, que es
 * como Esteban la va a ver en el manual.
 *
 * Al 6-set-2026: histórico 912, de la app 171, del CRM viejo 741 (912 − 741).
 * El reparto por estado y por técnico se mantiene inventado —el manual necesita
 * los cinco estados poblados para poder explicarlos— pero **escalado para que
 * sume 171**, no un número suelto.
 */
const METRICS: AdminMetrics = {
  todayCount: 4,
  monthCount: 47,
  pendingSyncCount: 1,
  totalInspections: 171,
  techniciansCount: 6,
  activeTechnicians: 4,
  last7Days: [
    { dayLabel: "jue 23", count: 6 },
    { dayLabel: "vie 24", count: 9 },
    { dayLabel: "sáb 25", count: 3 },
    { dayLabel: "dom 26", count: 0 },
    { dayLabel: "lun 27", count: 7 },
    { dayLabel: "mar 28", count: 11 },
    { dayLabel: "mié 29", count: 4 },
  ],
  // Suman 171, igual que `totalInspections`. Antes sumaban 682 contra un total
  // de 812: dos cifras de la misma pantalla que no se podían conciliar.
  byTechnician: [
    { clerkId: "u1", name: "Esteban Vargas", count: 54 },
    { clerkId: "u2", name: "Técnico 2", count: 42 },
    { clerkId: "u3", name: "Técnico 3", count: 35 },
    { clerkId: "u4", name: "Kevin Solano", count: 24 },
    { clerkId: "u5", name: "María Fernández", count: 13 },
    { clerkId: "u6", name: "Técnico 6", count: 3 },
  ],
  // También suman 171. Los cinco estados quedan poblados a propósito: el
  // capítulo de Inspecciones tiene que poder explicarlos todos, y en producción
  // hoy solo hay dos con filas.
  byStatus: {
    draft: 8,
    completed: 26,
    pending_sync: 1,
    synced: 45,
    report_delivered: 91,
  },
};

/* -------------------------------------------------------------------------- */
/* Resumen ejecutivo — datos REALES de producción, 25-ago-2026                 */
/* -------------------------------------------------------------------------- */

/**
 * A diferencia de `METRICS`, esto **no es inventado**: es la respuesta literal
 * de producción. Se hace así por una razón concreta —una muestra escrita a mano
 * ya mostró una vez la tasa de agosto con la nota de julio, y otra vez las
 * semanas cambiadas—, y porque las proporciones reales son las que ponen a
 * prueba el diseño: un canal con 72% y otro con 0,6% en la misma barra apilada.
 *
 * Para regenerarlo:
 *
 *   npx convex run --prod bi/metrics:executiveSummary '{}'
 *   npx convex run --prod bi/metrics:financeSummary '{}'
 *   npx convex run --prod bi/channels:channelRevenue '{}'
 */
const RESUMEN: ExecutiveSummary = {
  "conversionPct": 2.42,
  "conversionPctOfPhoned": 2.44,
  "convertidos": 225,
  "gastosCRC": 31379339,
  "ingresosFinancierosCRC": 52909410,
  "ingresosInspeccionesCRC": 54357284,
  "leadToClientePct": 2.42,
  "leadsTotal": 9290,
  "leadsWithPhone": 9218,
  "marginPct": 40.69,
  "note": "Revisiones = inspections_all (unión+dedupe, A30). Ingresos titulares = finance_entries (P&L oficial, A16). Conversión titular = bi_matches banda alta+media (A29).",
  "placeholderRows": 0,
  "revisionesConMonto": 912,
  "totalRevisiones": 912,
  "totalRevisionesSinPlaceholder": 912,
  "utilidadCRC": 21530071
};

const MESES: FinanceMonth[] = [
  { yearMonth: "2025-07", rows: 40, income: 4_011_000, expense: 1_927_710, utilidad: 2_083_290, marginPct: 51.94 },
  { yearMonth: "2025-08", rows: 33, income: 2_219_373, expense: 1_517_100, utilidad: 702_273, marginPct: 31.64 },
  { yearMonth: "2025-09", rows: 40, income: 3_673_650, expense: 1_977_539, utilidad: 1_696_111, marginPct: 46.17 },
  { yearMonth: "2025-10", rows: 35, income: 2_448_215, expense: 1_645_709, utilidad: 802_506, marginPct: 32.78 },
  { yearMonth: "2025-11", rows: 34, income: 3_328_975, expense: 1_648_420, utilidad: 1_680_555, marginPct: 50.48 },
  // Diciembre en rojo: el único mes negativo, y el caso que prueba que la
  // barra de utilidad no asuma signo positivo.
  { yearMonth: "2025-12", rows: 23, income: 1_431_537, expense: 1_445_833, utilidad: -14_296, marginPct: -1 },
  { yearMonth: "2026-01", rows: 41, income: 3_913_872, expense: 2_003_327, utilidad: 1_910_545, marginPct: 48.81 },
  { yearMonth: "2026-02", rows: 41, income: 3_737_538, expense: 1_791_344, utilidad: 1_946_194, marginPct: 52.07 },
  { yearMonth: "2026-03", rows: 43, income: 3_227_500, expense: 2_786_017, utilidad: 441_483, marginPct: 13.68 },
  { yearMonth: "2026-04", rows: 48, income: 3_971_750, expense: 3_072_113, utilidad: 899_637, marginPct: 22.65 },
  { yearMonth: "2026-05", rows: 43, income: 4_376_000, expense: 2_676_086, utilidad: 1_699_914, marginPct: 38.85 },
  { yearMonth: "2026-06", rows: 45, income: 5_618_000, expense: 2_858_037, utilidad: 2_759_963, marginPct: 49.13 },
  { yearMonth: "2026-07", rows: 46, income: 4_546_000, expense: 3_035_269, utilidad: 1_510_731, marginPct: 33.23 },
  { yearMonth: "2026-08", rows: 107, income: 4_591_000, expense: 1_959_550, utilidad: 2_631_450, marginPct: 57.32 },
];

const CANALES: ChannelMixRow[] = [
  { canal: "Mercadeo", rows: 642, rowsConMonto: 642, ingresosCRC: 39_025_209, pctIngresos: 73.9, pctRows: 72.4, ticketPromedioCRC: 60_787, ultimaRevisionISO: "2026-08-25", mesesSinRevision: 0 },
  { canal: "Recompra", rows: 110, rowsConMonto: 110, ingresosCRC: 6_290_140, pctIngresos: 11.9, pctRows: 12.4, ticketPromedioCRC: 57_183, ultimaRevisionISO: "2026-08-25", mesesSinRevision: 0 },
  { canal: "Referido", rows: 74, rowsConMonto: 74, ingresosCRC: 4_227_971, pctIngresos: 8, pctRows: 8.3, ticketPromedioCRC: 57_135, ultimaRevisionISO: "2026-08-25", mesesSinRevision: 0 },
  // TikTok lleva 3 meses sin una revisión: el caso que pinta el aviso ámbar.
  { canal: "TikTok", rows: 39, rowsConMonto: 39, ingresosCRC: 1_990_419, pctIngresos: 3.8, pctRows: 4.4, ticketPromedioCRC: 51_036, ultimaRevisionISO: "2026-05-27", mesesSinRevision: 3 },
  { canal: "Buscador", rows: 17, rowsConMonto: 17, ingresosCRC: 959_449, pctIngresos: 1.8, pctRows: 1.9, ticketPromedioCRC: 56_438, ultimaRevisionISO: "2026-08-24", mesesSinRevision: 0 },
  // 0,6%: el segmento más flaco que la barra apilada tiene que seguir mostrando.
  { canal: "(sin canal)", rows: 5, rowsConMonto: 5, ingresosCRC: 301_096, pctIngresos: 0.6, pctRows: 0.6, ticketPromedioCRC: 60_219, ultimaRevisionISO: "2026-03-02", mesesSinRevision: 5 },
];

/**
 * El selector de periodo **sí cambia de estado** en la vista de revisión, pero
 * los datos no se recalculan: no hay backend acá. Sirve para aprobar el control
 * y, sobre todo, para ver el bloque explicativo que solo aparece con un periodo
 * activo — que es justo la parte del diseño que hay que juzgar.
 */
export function AdminShellPreview() {
  const [periodo, setPeriodo] = useState<PeriodoKey>("todo");

  return (
    <DevAdminShell activePath="/admin">
      <div>
        <ResumenEjecutivo
          periodo={RESUMEN}
          historico={RESUMEN}
          /* Un periodo previo más flojo, para poder revisar la variación en sus
             dos signos: utilidad e ingresos suben, gastos bajan (A135). */
          anterior={
            periodo === "todo"
              ? null
              : {
                  ...RESUMEN,
                  utilidadCRC: Math.round(RESUMEN.utilidadCRC * 0.72),
                  ingresosFinancierosCRC: Math.round(
                    RESUMEN.ingresosFinancierosCRC * 0.85,
                  ),
                  gastosCRC: Math.round(RESUMEN.gastosCRC * 1.09),
                  totalRevisiones: Math.round(RESUMEN.totalRevisiones * 0.93),
                }
          }
          meses={MESES}
          canales={CANALES}
          periodoKey={periodo}
          onPeriodo={setPeriodo}
        />
        <div className="mt-10 border-t border-[var(--bi-ring)] pt-8">
          {/* El histórico es mayor que lo de la app, que es el caso real y el
              que dispara el aviso del universo (A133). */}
          <AdminDashboard metrics={METRICS} revisionesHistorico={912} />
        </div>
      </div>
    </DevAdminShell>
  );
}
