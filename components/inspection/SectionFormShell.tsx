"use client";

import { ArrowLeft, MoreVertical } from "lucide-react";
import Link from "next/link";
import { SectionProgress } from "@/components/inspection/SectionProgress";
import { cn } from "@/lib/utils";

type SectionFormShellProps = {
  title: string;
  backHref: string;
  progressCurrent: number;
  progressTotal: number;
  saveStatus: "idle" | "saving" | "saved";
  children: React.ReactNode;
  className?: string;
};

/** Shell: cabecera, barra de progreso y área de scroll (sin ítems). */
export function SectionFormShell({
  title,
  backHref,
  progressCurrent,
  progressTotal,
  saveStatus,
  children,
  className,
}: SectionFormShellProps) {
  const statusText =
    saveStatus === "saving"
      ? "Guardando…"
      : saveStatus === "saved"
        ? "Guardado ✓"
        : null;

  return (
    <div className={cn("min-h-dvh bg-[#f6f7f8] dark:bg-background", className)}>
      <div className="sticky top-0 z-30 border-b border-border bg-[#f6f7f8]/95 backdrop-blur-md dark:bg-background/95">
        <div className="mx-auto flex max-w-lg items-center gap-3 p-4">
          <Link
            href={backHref}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-label="Volver"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="flex-1 text-lg font-bold leading-tight text-foreground">
            {title}
          </h1>
          <button
            type="button"
            className="flex size-10 items-center justify-center text-muted-foreground"
            aria-label="Más opciones"
          >
            <MoreVertical className="size-5" />
          </button>
        </div>
        <div className="mx-auto max-w-lg px-4 pb-3">
          <SectionProgress
            current={progressCurrent}
            total={progressTotal}
          />
          {statusText ? (
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {statusText}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-4 pb-36 pt-4">{children}</div>
    </div>
  );
}
