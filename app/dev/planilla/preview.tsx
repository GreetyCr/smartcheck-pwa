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
 * La respuesta literal de `bi/pagosTecnico:pagosTecnico` contra producción para
 * agosto de 2026. No se escribe a mano: la primera versión la armé yo y ya
 * traía las semanas cambiadas respecto de las reales.
 *
 * Se regenera con
 * `npx convex run --prod bi/pagosTecnico:pagosTecnico '{"yearMonth":"2026-08"}'`.
 */
const PAGOS_AGOSTO = {
    "aviso": null,
    "comisionTotalCRC": 26600,
    "confiable": true,
    "revisionesDeOtros": 21,
    "tarifas": {
      "comisionPorRevision": 3800,
      "revisionesSinComision": 45,
      "viaticoPorRevision": 2000
    },
    "tecnicos": [
      {
        "clerkId": "user_3GYaescpEF0U177qKsdUJvE7Nof",
        "comisionCRC": 26600,
        "nombre": "Sergio Smartcheck",
        "revisiones": 52,
        "revisionesConComision": 7,
        "semanas": [
          {
            "lunes": "2026-08-03",
            "revisiones": 19,
            "viaticosCRC": 38000
          },
          {
            "lunes": "2026-08-10",
            "revisiones": 14,
            "viaticosCRC": 28000
          },
          {
            "lunes": "2026-08-17",
            "revisiones": 13,
            "viaticosCRC": 26000
          },
          {
            "lunes": "2026-08-24",
            "revisiones": 6,
            "viaticosCRC": 12000
          }
        ],
        "viaticosCRC": 104000
      }
    ],
    "viaticosTotalCRC": 104000,
    "yearMonth": "2026-08"
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
              /**
               * **`insumos` solo cuando el mes NO está bloqueado — A153.**
               *
               * Antes iba siempre, así que en julio se pintaban a la vez el
               * aviso «registrarlo acá **las duplicaría**» y el pie «confirmar
               * otra vez **corrige**; no las duplica». **En producción eso no
               * pasa** —`registrarPlanilla` lanza si el mes ya trae líneas de
               * otra vía, así que un mes bloqueado no llega a tener insumos—,
               * pero acá se veían las dos frases contradiciéndose sobre el único
               * botón que Esteban aprieta cada mes.
               *
               * Lo encontró el QA de usuario cero y lo puso de primero. Importa
               * el doble porque **las capturas del manual salen de estas
               * páginas**: la foto habría enseñado una contradicción inexistente.
               */
              insumos: bloqueado ? null : {
                salarioCRC: 430_000,
                comisionesCRC: 73_000,
                baseImponibleCRC: 1_000_000,
                /* `null` reproduce un mes registrado ANTES de A129, que es el
                   caso que hay hoy en producción y el que trae el aviso. */
                feriadosDias: null,
                tasas: tasasDelMes(mes),
                updatedAt: Date.parse("2026-08-24T09:00:00-06:00"),
              },
              /* Un feriado detectado, para poder revisar el bloque con
                 contenido; en setiembre el 15 cae en el mes. */
              feriadosDetectados: {
                dias: 1, // solo el obligatorio suma
                detalle: [
                  {
                    fecha: "2026-09-15",
                    nombre: "Independencia",
                    tipo: "obligatorio" as const,
                    tecnico: "Sergio Smartcheck",
                    revisiones: 2,
                  },
                  {
                    /* 31 de agosto, no 1.º de setiembre. Estaba inventada acá y
                       contradecía a `convex/bi/lib/feriados.ts` y al diccionario
                       que ya recibió Esteban — A153. */
                    fecha: "2026-08-31",
                    nombre: "Día de la Persona Negra y la Cultura Afrocostarricense",
                    tipo: "no_obligatorio" as const,
                    tecnico: "Sergio Smartcheck",
                    revisiones: 2,
                  },
                ],
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
                /* El selector de la muestra llega hasta el mes de hoy, así que
                   este es el estado que hay que poder aprobar: el aviso del mes
                   en curso aparece al elegir el último (A120). */
                enCurso: mes === new Date().toISOString().slice(0, 7),
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
