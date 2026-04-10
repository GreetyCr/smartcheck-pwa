"use client";

import { cn } from "@/lib/utils";

type SectionFooterProps = {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

const CTA_ORANGE = "#ff8c00";

export function SectionFooter({
  label = "Guardar y continuar",
  onClick,
  disabled,
  className,
}: SectionFooterProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#f8f9fa]/90 backdrop-blur-lg dark:bg-background/90",
        className,
      )}
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-lg px-4 pt-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className="w-full rounded-xl py-4 text-base font-extrabold uppercase tracking-wider text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            backgroundColor: CTA_ORANGE,
            boxShadow: "0 10px 25px -10px rgba(255, 140, 0, 0.45)",
          }}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
