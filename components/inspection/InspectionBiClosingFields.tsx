"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type Props = { inspectionId: Id<"inspections"> };

export function InspectionBiClosingFields({ inspectionId }: Props) {
  const doc = useQuery(api.inspections.get, { id: inspectionId });
  const patchInspection = useMutation(api.inspections.patch);

  if (doc === undefined || doc === null) {
    return null;
  }

  const commission = doc.biCommission ?? null;
  const condition = doc.biVehicleCondition ?? null;

  const pill = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "bg-muted text-muted-foreground hover:bg-muted/80",
    );

  const setCommissionAndSave = (v: "si" | "no") => {
    void patchInspection({
      id: inspectionId,
      patch: { biCommission: v },
    });
  };

  const setConditionAndSave = (n: 1 | 2 | 3) => {
    void patchInspection({
      id: inspectionId,
      patch: { biVehicleCondition: n },
    });
  };

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Datos internos (no salen en el PDF)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Comisión y estado del vehículo para análisis; solo se guardan en la base de
          datos.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Comisión</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={pill(commission === "si")}
            onClick={() => setCommissionAndSave("si")}
          >
            Sí
          </button>
          <button
            type="button"
            className={pill(commission === "no")}
            onClick={() => setCommissionAndSave("no")}
          >
            No
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">
          Estado del vehículo
        </p>
        <p className="mb-2 text-xs text-muted-foreground">
          1 = bueno · 2 = regular · 3 = mal estado
        </p>
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={pill(condition === n)}
              onClick={() => setConditionAndSave(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
