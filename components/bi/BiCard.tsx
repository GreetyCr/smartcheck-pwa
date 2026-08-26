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
        // `min-w-0` no es decorativo: como ítem de grid/flex, una tarjeta tiene
        // `min-width: auto` y **crece hasta el ancho mínimo de su contenido**,
        // desbordando su celda y empujando el documento. A 375px eso ponía a
        // las tarjetas en 388px dentro de una columna de 343 y dejaba todo el
        // tablero con scroll horizontal. Medido, no supuesto.
        "bi-lift min-w-0 rounded-2xl border border-[var(--bi-ring)] bg-[var(--bi-surface)]",
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
