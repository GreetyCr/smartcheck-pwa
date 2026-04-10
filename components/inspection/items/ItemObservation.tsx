"use client";

import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

type ItemObservationProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  className?: string;
  /** Micrófono reservado para dictado (sin acción aún). */
  showMic?: boolean;
};

export function ItemObservation({
  value,
  onChange,
  placeholder,
  multiline = true,
  disabled,
  className,
  showMic = true,
}: ItemObservationProps) {
  const common =
    "w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2";

  return (
    <div className={cn("relative", className)}>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={cn(common, "min-h-[80px] resize-y pr-10")}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(common, "pr-10")}
        />
      )}
      {showMic ? (
        <button
          type="button"
          className="absolute right-3 top-3 text-primary opacity-80 hover:opacity-100"
          aria-label="Dictado por voz (próximamente)"
          disabled={disabled}
        >
          <Mic className="size-5" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
