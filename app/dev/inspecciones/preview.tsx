"use client";

import { InspeccionesResumen } from "@/components/bi/InspeccionesResumen";
import type { InspeccionesPanel } from "@/components/bi/types";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Datos de PRODUCCIÓN congelados **al 1-set-2026**: las 904 revisiones, sus 18
 * meses y los dos técnicos. Se regeneran con
 * `npx convex run --prod bi/inspecciones:inspecciones '{}'`.
 *
 * Los **agregados son literales** porque el punto de esta vista es aprobar el
 * diseño con las magnitudes reales: 18 meses no se rotulan como 6, y un reparto
 * de 101/62 sobre 163 atribuibles se ve muy distinto a uno parejo. La forma de
 * la serie tampoco se puede inventar — el traspaso del CRM viejo a la app
 * (56 → 66 → 30 → 0) es justo lo que hay que poder leer de un vistazo.
 *
 * Los **nombres de los técnicos son inventados**, igual que en la muestra de
 * Leads: esta vista no pide sesión y esos son nombres de personal. Los ids
 * también van cambiados.
 */
const PANEL: InspeccionesPanel = {
  total: 904,
  totalHistorico: 904,
  conFiltros: false,
  deLaApp: 163,
  delHistorico: 741,
  porMes: [
    { yearMonth: "2025-04", total: 7, app: 0, legacy: 7 },
    { yearMonth: "2025-05", total: 62, app: 0, legacy: 62 },
    { yearMonth: "2025-06", total: 70, app: 0, legacy: 70 },
    { yearMonth: "2025-07", total: 74, app: 0, legacy: 74 },
    { yearMonth: "2025-08", total: 41, app: 0, legacy: 41 },
    { yearMonth: "2025-09", total: 31, app: 0, legacy: 31 },
    { yearMonth: "2025-10", total: 36, app: 0, legacy: 36 },
    { yearMonth: "2025-11", total: 47, app: 0, legacy: 47 },
    { yearMonth: "2025-12", total: 23, app: 0, legacy: 23 },
    { yearMonth: "2026-01", total: 51, app: 0, legacy: 51 },
    { yearMonth: "2026-02", total: 45, app: 0, legacy: 45 },
    { yearMonth: "2026-03", total: 53, app: 0, legacy: 53 },
    { yearMonth: "2026-04", total: 49, app: 0, legacy: 49 },
    { yearMonth: "2026-05", total: 64, app: 8, legacy: 56 },
    { yearMonth: "2026-06", total: 85, app: 19, legacy: 66 },
    { yearMonth: "2026-07", total: 76, app: 46, legacy: 30 },
    { yearMonth: "2026-08", total: 87, app: 87, legacy: 0 },
    { yearMonth: "2026-09", total: 3, app: 3, legacy: 0 },
  ],
  porTecnico: [
    {
      technicianId: "user_muestra_a",
      nombre: "Técnico de muestra A",
      rol: "tecnico",
      rows: 101,
      primeraMs: Date.parse("2026-07-16T10:00:00-06:00"),
      ultimaMs: Date.parse("2026-09-01T10:00:00-06:00"),
      porMes: [
        { yearMonth: "2026-07", rows: 33 },
        { yearMonth: "2026-08", rows: 65 },
        { yearMonth: "2026-09", rows: 3 },
      ],
    },
    {
      technicianId: "user_muestra_b",
      nombre: "Cuenta de muestra B (admin)",
      /* En PROD estas 62 son de Esteban, desde su cuenta de admin: sus revisiones
         no generan viático ni comisión (B36). La muestra reproduce ese caso
         porque es el que hay que poder aprobar visualmente. */
      rol: "admin",
      rows: 62,
      primeraMs: Date.parse("2026-05-10T10:00:00-06:00"),
      ultimaMs: Date.parse("2026-08-28T10:00:00-06:00"),
      porMes: [
        { yearMonth: "2026-05", rows: 8 },
        { yearMonth: "2026-06", rows: 19 },
        { yearMonth: "2026-07", rows: 13 },
        { yearMonth: "2026-08", rows: 22 },
      ],
    },
  ],
  sinTecnico: 741,
  atribuibles: 163,
  note: "Muestra congelada del 1-set-2026.",
};

/** El mismo panel con un periodo puesto, para revisar cómo cambia el titular. */
const PANEL_FILTRADO: InspeccionesPanel = {
  ...PANEL,
  conFiltros: true,
  total: 166,
  deLaApp: 136,
  delHistorico: 30,
  porMes: PANEL.porMes.filter((m) => m.yearMonth >= "2026-07"),
  porTecnico: [
    { ...PANEL.porTecnico[0], rows: 101 },
    { ...PANEL.porTecnico[1], rows: 35, porMes: [
      { yearMonth: "2026-07", rows: 13 },
      { yearMonth: "2026-08", rows: 22 },
    ] },
  ],
  sinTecnico: 30,
  atribuibles: 136,
};

export function InspeccionesPreview() {
  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — agregados reales de
        producción congelados; nombres de técnicos inventados. No existe en
        producción.
      </div>
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <p className="bi-num mb-3 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          Sin filtros — el histórico completo
        </p>
        <InspeccionesResumen panel={PANEL} />

        <p className="bi-num mb-3 mt-10 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          Con un periodo puesto — el titular cambia y el histórico queda de
          referencia
        </p>
        <InspeccionesResumen panel={PANEL_FILTRADO} />
      </div>
    </>
  );
}
