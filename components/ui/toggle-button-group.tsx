"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ToggleButtonGroupOption<T extends string | number> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

type ToggleButtonGroupProps<T extends string | number> = {
  value: T;
  onChange: (value: T) => void;
  options: ToggleButtonGroupOption<T>[];
  className?: string;
  /** ID del grupo para accesibilidad */
  labelId?: string;
  /** `filled`: fondo primary al seleccionar. `outline`: borde primary y fondo suave. */
  variant?: "filled" | "outline";
};

export function ToggleButtonGroup<T extends string | number>({
  value,
  onChange,
  options,
  className,
  labelId,
  variant = "filled",
}: ToggleButtonGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className={cn("grid auto-cols-fr grid-flow-col gap-2", className)}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        const outlineSelected =
          selected && variant === "outline"
            ? "border-primary bg-primary/10 text-primary"
            : null;
        const outlineIdle =
          !selected && variant === "outline"
            ? "border-border bg-card text-muted-foreground hover:border-primary/40"
            : null;
        const filledSelected =
          selected && variant === "filled"
            ? "border-primary bg-primary text-primary-foreground"
            : null;
        const filledIdle =
          !selected && variant === "filled"
            ? "border-border bg-card text-muted-foreground hover:border-primary/40"
            : null;

        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors",
              outlineSelected,
              outlineIdle,
              filledSelected,
              filledIdle,
            )}
          >
            {opt.icon ? <span className="shrink-0 [&_svg]:size-5">{opt.icon}</span> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
