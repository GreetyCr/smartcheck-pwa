"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  blue: "border-[#1E3A5F]/20 bg-white text-[#1E3A5F] [&_.icon-wrap]:bg-[#1E3A5F]/10 [&_.icon-wrap]:text-[#1E3A5F]",
  green:
    "border-emerald-200 bg-white text-emerald-900 [&_.icon-wrap]:bg-emerald-100 [&_.icon-wrap]:text-emerald-800",
  yellow:
    "border-amber-200 bg-white text-amber-900 [&_.icon-wrap]:bg-amber-100 [&_.icon-wrap]:text-amber-800",
  purple:
    "border-violet-200 bg-white text-violet-900 [&_.icon-wrap]:bg-violet-100 [&_.icon-wrap]:text-violet-800",
} as const;

export type MetricVariant = keyof typeof variants;

type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: MetricVariant;
  className?: string;
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "blue",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm",
        variants[variant],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {title}
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
          {subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="icon-wrap flex size-11 shrink-0 items-center justify-center rounded-xl">
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}
