"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Database, Loader2, Settings } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { browserAlert } from "@/lib/browser-confirm";

export default function AdminConfiguracionPage() {
  const migrateCountries = useMutation(
    api.migrations.migrateLegacyCountryOfOrigin,
  );
  const [running, setRunning] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Ajustes del sistema (próximamente).
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 size-5 shrink-0 text-[#1E3A5F]" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="font-semibold text-foreground">
                Migración: país de origen (legado)
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Convierte valores antiguos (Estados Unidos, Corea, Japón, etc.)
                al catálogo actual (USA, Korea, Otros…). Ejecutar una vez tras
                actualizar el esquema; solo administradores.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={running}
              className="gap-2 rounded-xl"
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
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-white p-6 text-sm text-muted-foreground shadow-sm">
        <Settings className="mt-0.5 size-5 shrink-0 text-[#FF8C00]" aria-hidden />
        <div>
          <p className="font-medium text-foreground">En construcción</p>
          <p className="mt-1">
            Aquí podrás definir parámetros globales, integraciones y auditoría
            cuando estén disponibles.
          </p>
        </div>
      </div>
    </div>
  );
}
