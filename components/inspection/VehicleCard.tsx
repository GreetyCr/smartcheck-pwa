"use client";

import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

type VehicleCardProps = {
  plate: string;
  brandModelYear: string;
  /** Ej. color y carrocería — si no hay datos en schema, usar placeholders. */
  subtitle?: string;
  className?: string;
};

export function VehicleCard({
  plate,
  brandModelYear,
  subtitle = "— • —",
  className,
}: VehicleCardProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Car className="size-7" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Plate
          </span>
          <span className="font-bold text-primary">{plate || "—"}</span>
        </div>
        <p className="mt-1 font-semibold text-foreground">{brandModelYear}</p>
        <p className="text-sm italic text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
