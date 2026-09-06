"use client";

import { cn } from "@/lib/utils";

/** Contenedor de sección del tablero: superficie grafito + hairline + título. */
export function BiCard({
  title,
  subtitle,
  titleAs = "h2",
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  /**
   * Nivel del título. Por omisión `h2`, que es lo correcto **debajo** del `h1`
   * de la pantalla. Se baja a `p` en las tarjetas que se pintan **antes** del
   * `h1` —hoy solo el interruptor del bot en Leads—: dos `h2` antes del `h1`
   * rompen el orden de encabezados y un lector de pantalla los anuncia como
   * secciones de algo que todavía no empezó (A157, WCAG 1.3.1).
   */
  titleAs?: "h2" | "p";
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
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-[var(--bi-ring)] px-4 py-3 sm:px-5">
          {/* `flex-wrap` + `basis-40`: sin eso el título y la acción se reparten
              una sola línea a la fuerza, y una acción ancha —el selector de
              periodo del desglose de gastos son cuatro botones— dejaba al
              título **en 20 px**, con «En qué se va el gasto» en una columna de
              una letra por renglón dentro de una tarjeta de 343. Medido a
              375 px, no supuesto. Con una base de 160 px el título se planta y
              la acción baja sola al renglón siguiente cuando no cabe. */}
          <div className="min-w-0 flex-1 basis-40">
            {titleAs === "p" ? (
              <p className="text-[15px] font-semibold text-[var(--bi-ink)]">
                {title}
              </p>
            ) : (
              <h2 className="text-[15px] font-semibold text-[var(--bi-ink)]">
                {title}
              </h2>
            )}
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
