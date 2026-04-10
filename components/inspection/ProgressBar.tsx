"use client";

import { cn } from "@/lib/utils";

type ProgressBarProps = {
  /** Paso actual (1-based) */
  step: number;
  totalSteps: number;
  /** Si se define, fila superior: título a la izquierda y “Paso X de Y” a la derecha (sin %). */
  sectionTitle?: string;
  className?: string;
};

export function ProgressBar({
  step,
  totalSteps,
  sectionTitle,
  className,
}: ProgressBarProps) {
  const pct = Math.round((step / totalSteps) * 100);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 text-sm">
        {sectionTitle ? (
          <>
            <span className="font-bold text-primary">{sectionTitle}</span>
            <span className="shrink-0 font-semibold text-foreground">
              Paso {step} de {totalSteps}
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold text-foreground">
              Paso {step} de {totalSteps}
            </span>
            <span className="text-muted-foreground">{pct}% completado</span>
          </>
        )}
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso ${pct} por ciento`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
