"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { LocationPicker } from "@/components/ui/location-picker";
import { useInspectionWizard } from "@/components/inspection/InspectionWizard";
import {
  isValidPhoneCr8Digits,
  normalizePhoneDigitsCr,
} from "@/lib/phone-cr";
import type { CaptureSource } from "@/types/inspection-draft";
import { cn } from "@/lib/utils";

const CAPTURE_LABELS: Record<CaptureSource, string> = {
  publicidad: "Publicidad",
  tiktok: "TikTok",
  buscador: "Buscador",
  recompra: "Recompra",
  referido: "Referido",
};

const CAPTURE_ORDER: CaptureSource[] = [
  "publicidad",
  "tiktok",
  "buscador",
  "recompra",
  "referido",
];

const fieldClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30";

export function ClientForm({ className }: { className?: string }) {
  const router = useRouter();
  const { draft, setDraft } = useInspectionWizard();

  const phoneDigits = normalizePhoneDigitsCr(draft.clientPhone);

  const isValid = useMemo(() => {
    const nameOk = draft.clientName.trim().length >= 3;
    const phoneOk = isValidPhoneCr8Digits(phoneDigits);
    const locOk = draft.location.trim().length > 0;
    const sourceOk = draft.captureSource !== "";
    return nameOk && phoneOk && locOk && sourceOk;
  }, [
    draft.clientName,
    draft.location,
    draft.captureSource,
    phoneDigits,
  ]);

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setDraft({
      clientPhone: phoneDigits,
      outOfGamFee: draft.isInGAM ? 0 : undefined,
    });

    router.push("/inspecciones/nueva/vehiculo");
  }

  return (
    <form
      onSubmit={handleNext}
      className={cn("mx-auto max-w-lg space-y-5 px-4 py-4", className)}
    >
      <h2 className="text-xl font-bold text-primary">Datos del Cliente</h2>

      <div className="space-y-1.5">
        <label htmlFor="client-name" className="text-sm font-medium text-foreground">
          Nombre Completo
        </label>
        <input
          id="client-name"
          name="clientName"
          type="text"
          autoComplete="name"
          placeholder="Ej. Juan Pérez"
          value={draft.clientName}
          onChange={(e) => setDraft({ clientName: e.target.value })}
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="client-phone" className="text-sm font-medium text-foreground">
          Teléfono
        </label>
        <input
          id="client-phone"
          name="clientPhone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="+506 0000-0000"
          value={draft.clientPhone}
          onChange={(e) => setDraft({ clientPhone: e.target.value })}
          className={fieldClass}
        />
        {draft.clientPhone.length > 0 && !isValidPhoneCr8Digits(phoneDigits) ? (
          <p className="text-xs text-destructive">Ingresa 8 dígitos (Costa Rica).</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-foreground">Ubicación</span>
        <LocationPicker
          value={draft.location}
          onChange={(location) => setDraft({ location })}
          onCoordsChange={(locationCoords) =>
            setDraft({ locationCoords })
          }
        />
      </div>

      <div className="space-y-1.5">
        <span id="revisiones-label" className="text-sm font-medium text-foreground">
          Cantidad de Revisiones
        </span>
        <ToggleButtonGroup
          labelId="revisiones-label"
          value={draft.inspectionCount}
          onChange={(inspectionCount) => setDraft({ inspectionCount })}
          options={[
            { value: 1 as const, label: "1" },
            { value: 2 as const, label: "2" },
            { value: 3 as const, label: "3+" },
          ]}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <input
          type="checkbox"
          checked={draft.isInGAM}
          onChange={(e) => setDraft({ isInGAM: e.target.checked })}
          className="mt-1 size-4 shrink-0 rounded border-border text-primary"
        />
        <span className="text-sm leading-snug">
          <span className="font-medium text-foreground">¿Se encuentra en el GAM?</span>
          <span className="mt-0.5 block text-muted-foreground">
            Gran Área Metropolitana
          </span>
        </span>
      </label>

      <div className="space-y-1.5">
        <label htmlFor="capture-source" className="text-sm font-medium text-foreground">
          ¿Cómo nos conoció?
        </label>
        <div className="relative">
          <select
            id="capture-source"
            name="captureSource"
            value={draft.captureSource}
            onChange={(e) =>
              setDraft({
                captureSource: e.target.value as CaptureSource | "",
              })
            }
            className={cn(
              fieldClass,
              "appearance-none bg-card pr-10",
              draft.captureSource === "" ? "text-muted-foreground" : "",
            )}
          >
            <option value="" disabled>
              Seleccione una opción
            </option>
            {CAPTURE_ORDER.map((key) => (
              <option key={key} value={key}>
                {CAPTURE_LABELS[key]}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={!isValid}
          size="lg"
          className="h-12 w-full rounded-2xl text-base font-semibold"
        >
          Siguiente
          <ArrowRight className="size-5" data-icon="inline-end" />
        </Button>
      </div>
    </form>
  );
}
