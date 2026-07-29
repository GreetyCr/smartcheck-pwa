"use client";

import { cn } from "@/lib/utils";

/** Contenedor de sección del tablero: superficie grafito + hairline + título. */
export function BiCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "bi-lift rounded-2xl border border-[var(--bi-ring)] bg-[var(--bi-surface)]",
        className,
      )}
    >
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-[var(--bi-ring)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--bi-ink)]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-[var(--bi-ink-3)]">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
