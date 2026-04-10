"use client";

import { cn } from "@/lib/utils";

type SectionProgressProps = {
  current: number;
  total: number;
  className?: string;
};

export function SectionProgress({
  current,
  total,
  className,
}: SectionProgressProps) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end justify-between">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Progreso de inspección
        </p>
        <p className="text-sm font-bold text-primary">
          {current}{" "}
          <span className="font-normal text-muted-foreground">/ {total}</span>
        </p>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
