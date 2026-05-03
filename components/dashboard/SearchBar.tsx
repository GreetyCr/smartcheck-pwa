"use client";

import { ScanLine, Search, X } from "lucide-react";
import { formControlValue } from "@/lib/browser-confirm";
import { cn } from "@/lib/utils";

export type SearchBarProps = {
  className?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  /** Acción escáner / filtro (placeholder futuro) */
  onScanClick?: () => void;
};

export function SearchBar({
  className,
  placeholder = "Buscar por placa o VIN...",
  value,
  onChange,
  onScanClick,
}: SearchBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm",
        className,
      )}
    >
      <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="search"
        name="search-plate-vin"
        autoComplete="off"
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        value={value}
        onChange={(e) => onChange(formControlValue(e))}
      />
      {value ? (
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Limpiar búsqueda"
          onClick={() => onChange("")}
        >
          <X className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onScanClick}
        className="shrink-0 rounded-lg p-1.5 text-primary transition-colors hover:bg-muted"
        aria-label="Escanear código"
      >
        <ScanLine className="size-5" />
      </button>
    </div>
  );
}
