"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PayrollMonthCard } from "@/components/bi/PayrollMonthCard";
import { TecnicoPagosCard } from "@/components/bi/TecnicoPagosCard";
import { toDateInputValue } from "@/lib/bi-format";

/**
 * Planilla del mes (B28) — Esteban escribe tres datos y el sistema deriva seis
 * líneas de gasto.
 *
 * Va en su propia ruta y no dentro de Finanzas a propósito: es una **captura
 * mensual**, no un tablero. Entre gráficos sería ruido once meses al año y
 * difícil de encontrar el mes que toca.
 */
export default function AdminPlanillaPage() {
  const [mes, setMes] = useState(() => toDateInputValue(Date.now()).slice(0, 7));
  const guardado = useQuery(api.bi.payroll.planillaDelMes, { yearMonth: mes });
  const pagos = useQuery(api.bi.public.pagosTecnico, { yearMonth: mes });
  const registrar = useMutation(api.bi.payroll.registrarPlanilla);

  // El puente entre las dos tarjetas: la de pagos calcula la comisión y la de
  // planilla la recibe, pero solo cuando Esteban pulsa el botón.
  const aplicarComision = useRef<((montoCRC: number) => void) | null>(null);
  const publicar = useCallback((fn: (montoCRC: number) => void) => {
    aplicarComision.current = fn;
  }, []);

  return (
    <div>
      <header className="mb-6">
        <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
          Planilla del mes
        </h1>
        <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          El pago del mes y los gastos que se calculan solos
        </p>
      </header>

      <div className="max-w-3xl">
        <PayrollMonthCard
          mes={mes}
          onMes={setMes}
          guardado={guardado}
          onRegistrar={registrar}
          onListoParaSugerencias={publicar}
        />

        {pagos ? (
          <div className="mt-5">
            <TecnicoPagosCard
              data={pagos}
              onUsarComision={(monto) => aplicarComision.current?.(monto)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
