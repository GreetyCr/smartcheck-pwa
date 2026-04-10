"use client";

import { cn } from "@/lib/utils";

type ProgressCardProps = {
  percent: number;
  completed: number;
  total: number;
  className?: string;
};

export function ProgressCard({
  percent,
  completed,
  total,
  className,
}: ProgressCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/15 bg-primary/[0.07] px-4 py-3 shadow-sm",
        className,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
        Progreso general
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-3xl font-bold tabular-nums text-primary">
          {percent}%
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {completed} de {total} secciones
        </span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-white/80"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
