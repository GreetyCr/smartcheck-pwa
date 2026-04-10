"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type WizardStepHeaderProps = {
  title: string;
  backHref?: string;
  className?: string;
};

export function WizardStepHeader({
  title,
  backHref = "/",
  className,
}: WizardStepHeaderProps) {
  return (
    <header
      className={cn(
        "relative flex h-14 shrink-0 items-center justify-center border-b border-border bg-card px-4",
        className,
      )}
    >
      <Link
        href={backHref}
        className="absolute left-3 flex size-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-muted"
        aria-label="Volver"
      >
        <ArrowLeft className="size-6" />
      </Link>
      <h1 className="max-w-[70%] truncate text-center text-base font-bold text-primary">
        {title}
      </h1>
    </header>
  );
}
