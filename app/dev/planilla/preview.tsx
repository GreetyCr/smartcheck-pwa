"use client";

import { useState } from "react";
import { PayrollMonthCard } from "@/components/bi/PayrollMonthCard";
import { TASAS_POR_DEFECTO } from "@/lib/payroll";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Revisión visual con los datos de julio de 2026 — los reales, porque el punto
 * es aprobar el diseño con las magnitudes de verdad. No toca Convex: el botón
 * no guarda nada.
 */
export function PlanillaPreview() {
  const [mes, setMes] = useState("2026-07");

  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — datos de julio, el botón no
        guarda. No existe en producción.
      </div>
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <div className="max-w-3xl">
          <PayrollMonthCard
            mes={mes}
            onMes={setMes}
            guardado={{
              yearMonth: mes,
              insumos: {
                salarioCRC: 430_000,
                comisionesCRC: 73_000,
                baseImponibleCRC: 1_000_000,
                tasas: TASAS_POR_DEFECTO,
                updatedAt: Date.parse("2026-08-24T09:00:00-06:00"),
              },
              tasasPorDefecto: TASAS_POR_DEFECTO,
            }}
            onRegistrar={async () => ({ creadas: 0, actualizadas: 6 })}
          />
        </div>
      </div>
    </>
  );
}
