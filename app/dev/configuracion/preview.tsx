"use client";

import { Database, Settings } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Revisión visual de **Configuración**.
 *
 * Es un espejo del render de `app/(admin)/admin/configuracion/page.tsx` con el
 * botón inerte: la mutation que dispara —`migrateLegacyCountryOfOrigin`—
 * **escribe en producción**, y una página de revisión no puede tener un botón
 * que migre datos de verdad si alguien lo pulsa por curiosidad.
 *
 * Existe desde el 6-set y la razón es la captura del manual. Antes esta pantalla
 * y Técnicos eran las dos únicas sin `/dev`, así que sus fotos las tenía que
 * sacar Greety a mano: salían **a menor densidad que las otras nueve** y, en el
 * caso de Técnicos, **con los correos reales del equipo**. Con estas dos páginas
 * las once salen del mismo script, a retina y sin datos de nadie.
 *
 * **Si el render real cambia, hay que cambiarlo acá también.** Es el precio de
 * duplicar, y se paga a sabiendas: la alternativa era extraer un componente
 * presentacional de una pantalla que hoy tiene un solo botón.
 */
export function ConfiguracionPreview() {
  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — el botón de migración no hace
        nada acá. No existe en producción.
      </div>
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <div>
          <header className="mb-6">
            <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
              Configuración
            </h1>
            <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
              Mantenimiento del sistema
            </p>
          </header>

          <div className="grid gap-4 xl:grid-cols-2">
            <BiCard
              title="Migración: país de origen (legado)"
              subtitle="Ejecutar una sola vez tras actualizar el esquema"
            >
              <div className="flex items-start gap-3">
                <Database
                  className="mt-0.5 size-5 shrink-0 text-[var(--bi-ink-3)]"
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-[13px] text-[var(--bi-ink-2)]">
                    Convierte valores antiguos (Estados Unidos, Corea, Japón,
                    etc.) al catálogo actual (USA, Korea, Otros…). Solo
                    administradores.
                  </p>
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--bi-ring)] px-4 text-[13px] font-medium text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] active:scale-[0.98] disabled:opacity-50"
                  >
                    Ejecutar migración de países
                  </button>
                </div>
              </div>
            </BiCard>

            <section className="rounded-2xl border border-dashed border-[var(--bi-ring)] bg-[var(--bi-surface)]/50 p-5">
              <div className="flex items-start gap-3">
                <Settings
                  className="mt-0.5 size-5 shrink-0 text-[var(--bi-ink-3)]"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--bi-ink)]">
                    En construcción
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--bi-ink-3)]">
                    Acá van a vivir los parámetros globales, las integraciones y
                    la auditoría cuando estén disponibles.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
