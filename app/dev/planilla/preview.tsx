"use client";

import { useCallback, useRef, useState } from "react";
import { PayrollMonthCard } from "@/components/bi/PayrollMonthCard";
import { TecnicoPagosCard } from "@/components/bi/TecnicoPagosCard";
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
/**
 * Agosto de 2026 leído de producción el 24-ago: Sergio 52 revisiones repartidas
 * en cuatro semanas, Esteban 21. Son los números reales para poder aprobar la
 * tarjeta con las magnitudes de verdad.
 */
const PAGOS_AGOSTO = {
  yearMonth: "2026-08",
  tecnicos: [
    {
      clerkId: "user_sergio",
      nombre: "Sergio Smartcheck",
      revisiones: 52,
      revisionesConComision: 7,
      viaticosCRC: 104_000,
      comisionCRC: 26_600,
      semanas: [
        { lunes: "2026-08-03", revisiones: 18, viaticosCRC: 36_000 },
        { lunes: "2026-08-10", revisiones: 13, viaticosCRC: 26_000 },
        { lunes: "2026-08-17", revisiones: 18, viaticosCRC: 36_000 },
        { lunes: "2026-08-24", revisiones: 3, viaticosCRC: 6_000 },
      ],
    },
  ],
  comisionTotalCRC: 26_600,
  viaticosTotalCRC: 104_000,
  revisionesDeOtros: 21,
  tarifas: {
    viaticoPorRevision: 2_000,
    comisionPorRevision: 3_800,
    revisionesSinComision: 45,
  },
  confiable: true,
  aviso: null,
};

export function PlanillaPreview() {
  const [mes, setMes] = useState("2026-07");
  const aplicar = useRef<((n: number) => void) | null>(null);
  const publicar = useCallback((fn: (n: number) => void) => {
    aplicar.current = fn;
  }, []);
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
            onListoParaSugerencias={publicar}
          />
          <div className="mt-5">
            <TecnicoPagosCard
              data={{
                ...PAGOS_AGOSTO,
                yearMonth: mes,
                confiable: mes >= "2026-08",
                aviso:
                  mes >= "2026-08"
                    ? null
                    : "Antes de 2026-08 el conteo por persona está incompleto: Sergio empezó a usar la app el 16-jul-2026 y la plataforma vieja, que no registra quién hizo cada revisión, se usó hasta el 19 de julio. El número de este mes se queda corto.",
              }}
              onUsarComision={(n) => aplicar.current?.(n)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
