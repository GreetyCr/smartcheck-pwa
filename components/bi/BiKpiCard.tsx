"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de indicador (stat tile). El valor grande usa cifras proporcionales
 * (no tabulares: no es una columna que deba alinearse). El delta va **siempre
 * con icono + rótulo**, nunca comunicado solo por color.
 */
export type KpiTone = "income" | "expense" | "utilidad" | "warn" | "neutral";

const TONE_VAR: Record<KpiTone, string> = {
  income: "var(--bi-income)",
  expense: "var(--bi-expense)",
  utilidad: "var(--bi-good)",
  /** Métrica que pide acción (p. ej. inspecciones sin sincronizar). */
  warn: "var(--bi-warn)",
  neutral: "var(--bi-ink-3)",
};

export function BiKpiCard({
  label,
  value,
  exact,
  hint,
  delta,
  tone = "neutral",
  index = 0,
  destacada = false,
}: {
  label: string;
  value: string;
  /**
   * Monto exacto, cuando el valor grande va abreviado (`₡4,55M`). Se muestra
   * SIEMPRE que se pase: el número corto es para escanear, no para creerle.
   * Sin esto, `₡4,55M` se lee como 4.555.000 cuando son ₡4.546.000 — pasó de
   * verdad al comparar contra la hoja de cálculo.
   */
  exact?: string;
  hint?: string;
  /** Variación vs. periodo anterior, en puntos porcentuales relativos. */
  delta?: { pct: number; label: string } | null;
  tone?: KpiTone;
  index?: number;
  /**
   * La tarjeta titular de una pantalla — **A135**.
   *
   * Cambia **solo el tamaño de la cifra y el aire**, no el color ni la
   * estructura: la jerarquía la tiene que dar el tamaño, que es lo que el ojo
   * lee primero, y no un acento distinto que competiría con el que ya identifica
   * a la métrica.
   */
  destacada?: boolean;
}) {
  const accent = TONE_VAR[tone];
  const dir = delta ? (delta.pct > 0 ? "up" : delta.pct < 0 ? "down" : "flat") : null;
  const DeltaIcon =
    dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  // El signo bueno/malo depende de la métrica: en gastos, subir es malo.
  const deltaGood =
    dir === "flat" || dir === null
      ? null
      : tone === "expense"
        ? dir === "down"
        : dir === "up";

  return (
    <div
      className={cn(
        "bi-lift bi-fade-up relative overflow-hidden rounded-2xl border border-[var(--bi-ring)] bg-[var(--bi-surface)]",
        destacada ? "flex flex-col justify-center p-5 sm:p-6" : "p-4",
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* barra de acento (identidad de la métrica) */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] rounded-r"
        style={{ background: accent }}
      />
      <p className="bi-num text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-semibold leading-none text-[var(--bi-ink)]",
          destacada
            ? "text-[40px] sm:text-[54px]"
            : "text-[26px] sm:text-[30px]",
        )}
        title={exact}
      >
        {value}
      </p>
      {exact ? (
        <p className="bi-num mt-1 text-[11px] tabular-nums text-[var(--bi-ink-3)]">
          {exact}
        </p>
      ) : null}
      {/* delta y pista en líneas propias: nunca compiten por el ancho */}
      <div className="mt-2 space-y-0.5">
        {delta ? (
          <span
            className="flex items-start gap-1 text-xs font-medium leading-tight"
            style={{
              color:
                deltaGood === null
                  ? "var(--bi-ink-3)"
                  : deltaGood
                    ? "var(--bi-good)"
                    : "var(--bi-bad)",
            }}
          >
            <DeltaIcon className="mt-[1px] size-3.5 shrink-0" aria-hidden />
            {/* **Envuelve, no trunca — A135.** La etiqueta nombra el periodo
                («vs los 3 previos») y en 375px la tarjeta deja 114px para 129
                de texto: truncar se comía justo la parte que dice contra qué se
                compara, que es lo único que la vuelve informativa. Partirla en
                dos líneas no pierde nada; la grilla iguala las alturas. */}
            <span>{delta.label}</span>
          </span>
        ) : null}
        {hint ? (
          <span className="block truncate text-xs text-[var(--bi-ink-3)]">
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}
