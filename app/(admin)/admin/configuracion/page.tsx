"use client";

import { Settings } from "lucide-react";

export default function AdminConfiguracionPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Ajustes del sistema (próximamente).
        </p>
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
