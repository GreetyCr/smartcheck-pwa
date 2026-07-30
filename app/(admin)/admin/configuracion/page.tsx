"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Database, Loader2, Settings } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { BiCard } from "@/components/bi/BiCard";
import { browserAlert } from "@/lib/browser-confirm";

export default function AdminConfiguracionPage() {
  const migrateCountries = useMutation(
    api.migrations.migrateLegacyCountryOfOrigin,
  );
  const [running, setRunning] = useState(false);

  return (
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
                Convierte valores antiguos (Estados Unidos, Corea, Japón, etc.)
                al catálogo actual (USA, Korea, Otros…). Solo administradores.
              </p>
              <button
                type="button"
                disabled={running}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--bi-ring)] px-4 text-[13px] font-medium text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] active:scale-[0.98] disabled:opacity-50"
                onClick={() => {
                  setRunning(true);
                  void migrateCountries({})
                    .then((r) => {
                      browserAlert(
                        `Migración lista: ${r.updated} inspecciones actualizadas de ${r.scanned} revisadas (${r.skipped} sin cambios).`,
                      );
                    })
                    .catch((e: unknown) => {
                      browserAlert(
                        e instanceof Error ? e.message : "No se pudo migrar.",
                      );
                    })
                    .finally(() => setRunning(false));
                }}
              >
                {running ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
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
                Acá van a vivir los parámetros globales, las integraciones y la
                auditoría cuando estén disponibles.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
