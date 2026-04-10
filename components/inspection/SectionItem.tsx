"use client";

import Link from "next/link";
import { Check, ChevronRight, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionRowStatus = "completado" | "en_curso" | "pendiente";

type SectionItemProps = {
  href: string;
  name: string;
  subtitle?: string;
  icon: LucideIcon;
  status: SectionRowStatus;
  findingsCount: number;
};

export function SectionItem({
  href,
  name,
  subtitle,
  icon: Icon,
  status,
  findingsCount,
}: SectionItemProps) {
  const isDone = status === "completado";
  const isActive = status === "en_curso";

  const statusLabel =
    status === "completado"
      ? "Completado"
      : status === "en_curso"
        ? "En curso…"
        : "Pendiente";

  const iconWrap = cn(
    "flex size-11 shrink-0 items-center justify-center rounded-full border-2",
    isDone && "border-emerald-500/50 bg-emerald-50 text-emerald-700",
    isActive && "border-primary bg-primary/10 text-primary",
    !isDone && !isActive && "border-muted bg-muted/40 text-muted-foreground",
  );

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 bg-card p-3 shadow-sm transition-colors active:bg-muted/40",
        isActive && "border-primary bg-primary/[0.08]",
        !isActive && "border-transparent",
      )}
    >
      <div className={iconWrap}>
        <Icon className="size-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{name}</p>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
        <p
          className={cn(
            "text-sm",
            isDone && "font-medium text-emerald-700",
            isActive && "italic text-primary",
            status === "pendiente" && "text-muted-foreground",
          )}
        >
          {statusLabel}
        </p>
        {findingsCount > 0 && isDone ? (
          <span className="mt-1 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            {findingsCount} hallazgos
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {isDone ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="size-4 stroke-[3]" />
          </span>
        ) : isActive ? (
          <span className="flex size-8 items-center justify-center rounded-full border-2 border-primary bg-white text-primary">
            <MoreHorizontal className="size-4" />
          </span>
        ) : (
          <ChevronRight className="size-5 text-muted-foreground" />
        )}
      </div>
    </Link>
  );
}
