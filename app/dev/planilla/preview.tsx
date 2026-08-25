"use client";

import { useState } from "react";
import { PayrollMonthCard } from "@/components/bi/PayrollMonthCard";
import { tasasDelMes, vigenciaDelMes } from "@/lib/payroll";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Las seis líneas que julio de 2026 ya trae desde la hoja de Esteban (B34).
 * Son las de verdad, no un ejemplo: el guard tiene que verse con los montos que
 * va a mostrar en producción.
 */
const JULIO_YA_EN_LA_HOJA = [
  { etiqueta: "IMPUESTOS", amountCRC: 130_000, source: "sheet" },
  { etiqueta: "APORTE PATRONO CCSS", amountCRC: 115_756, source: "sheet" },
  { etiqueta: "PROVISION AGUINALDO", amountCRC: 41_900, source: "sheet" },
  { etiqueta: "PROVISION PREAVISO", amountCRC: 41_900, source: "sheet" },
  { etiqueta: "PROVISION CESANTIA", amountCRC: 41_900, source: "sheet" },
  { etiqueta: "PROVISION VACACIONES", amountCRC: 20_957, source: "sheet" },
];

/**
 * Revisión visual con los datos de julio de 2026 — los reales, porque el punto
 * es aprobar el diseño con las magnitudes de verdad. No toca Convex: el botón
 * no guarda nada.
 *
 * Reproduce también el estado bloqueado igual que en producción: **julio está
 * bloqueado y agosto no**. Cambiando el mes en el selector se ven los dos, sin
 * ningún interruptor de mentira que haya que recordar apagar.
 */
export function PlanillaPreview() {
  const [mes, setMes] = useState("2026-07");
  // Marzo a julio de 2026 vinieron de la hoja; agosto en adelante está limpio.
  const bloqueado = mes >= "2026-03" && mes <= "2026-07";

  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — datos de julio, el botón no
        guarda. No existe en producción. Cambiá el mes a <strong>agosto</strong>{" "}
        para ver el formulario sin bloquear.
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
                tasas: tasasDelMes(mes),
                updatedAt: Date.parse("2026-08-24T09:00:00-06:00"),
              },
              tasasPorDefecto: tasasDelMes(mes),
              lineasYaCargadas: bloqueado ? JULIO_YA_EN_LA_HOJA : [],
              // Sale de la MISMA función que usa el servidor. Escribirla a mano
              // acá ya produjo una revisión con la tasa de agosto y la nota de
              // julio en la misma línea.
              vigencia: vigenciaDelMes(mes),
              // Se fuerza el choque en agosto para poder revisar el aviso.
              avisoPolizaINS:
                mes >= "2026-08" ? { etiqueta: "POLIZA INS", amountCRC: 8000 } : null,
            }}
            onRegistrar={async () => ({ creadas: 0, actualizadas: 6 })}
          />
        </div>
      </div>
    </>
  );
}
