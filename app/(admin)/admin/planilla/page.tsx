"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PayrollMonthCard } from "@/components/bi/PayrollMonthCard";
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
  const registrar = useMutation(api.bi.payroll.registrarPlanilla);

  return (
    <div>
      <header className="mb-6">
        <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
          Planilla del mes
        </h1>
        <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          Los gastos que se calculan solos
        </p>
      </header>

      <div className="max-w-3xl">
        <PayrollMonthCard
          mes={mes}
          onMes={setMes}
          guardado={guardado}
          onRegistrar={registrar}
        />
      </div>
    </div>
  );
}
