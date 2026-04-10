"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Fuel, Play, Plug } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { PhotoCapture } from "@/components/ui/PhotoCapture";
import { useInspectionWizard } from "@/components/inspection/InspectionWizard";
import { uploadFileToConvexStorage } from "@/lib/convex-storage";
import {
  BRAND_OPTIONS,
  COUNTRY_OPTIONS,
  draftEngineToConvex,
  isValidPlate,
  isValidVinOptional,
  normalizePlate,
  normalizeVin,
  parseMileageKm,
  parseYear,
} from "@/lib/vehicle-form";
import type { CaptureSource, CountryOriginKey } from "@/types/inspection-draft";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30";

export function VehicleForm({ className }: { className?: string }) {
  const router = useRouter();
  const { draft, setDraft } = useInspectionWizard();
  const createDraft = useMutation(api.inspections.createDraft);
  const generateUploadUrl = useMutation(api.inspections.generateUploadUrl);
  const patchInspection = useMutation(api.inspections.patch);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (
      !draft.captureSource ||
      draft.clientName.trim().length < 3
    ) {
      router.replace("/inspecciones/nueva/cliente");
    }
  }, [draft.captureSource, draft.clientName, router]);

  const yearNum = parseYear(draft.yearInput);
  const mileageNum = parseMileageKm(draft.mileageInput);
  const vinOk = isValidVinOptional(draft.vinInput);

  const isValid = useMemo(() => {
    const photoOk = draft.vehiclePhotoFile !== null;
    const plateOk = isValidPlate(draft.plate);
    const yearOk = yearNum !== null;
    const modelOk = draft.model.trim().length >= 2;
    const brandOk = draft.brand.trim().length > 0;
    const countryOk = draft.countryOfOrigin !== "";
    const mileageOk = mileageNum !== null;
    return (
      photoOk &&
      plateOk &&
      yearOk &&
      modelOk &&
      brandOk &&
      countryOk &&
      mileageOk &&
      vinOk
    );
  }, [
    draft.brand,
    draft.model,
    draft.plate,
    draft.vehiclePhotoFile,
    draft.countryOfOrigin,
    draft.vinInput,
    mileageNum,
    vinOk,
    yearNum,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !yearNum || !mileageNum || !draft.vehiclePhotoFile) return;

    setSubmitError(null);
    setSubmitting(true);

    try {
      const inspectionId = (await createDraft()) as Id<"inspections">;
      const source = draft.captureSource as CaptureSource;

      const postUrl = await generateUploadUrl();
      const storageId = await uploadFileToConvexStorage(
        postUrl,
        draft.vehiclePhotoFile,
      );

      const plate = normalizePlate(draft.plate);
      const vin = normalizeVin(draft.vinInput);

      await patchInspection({
        id: inspectionId,
        patch: {
          clientName: draft.clientName.trim(),
          clientPhone: draft.clientPhone.trim(),
          location: draft.location.trim(),
          captureSource: source,
          outOfGamFee: draft.isInGAM ? 0 : draft.outOfGamFee,
          vehicleBrand: draft.brand.trim(),
          vehicleModel: draft.model.trim(),
          vehicleYear: yearNum,
          identifier: plate,
          identifierType: "placa",
          vin: vin.length > 0 ? vin : undefined,
          mileage: mileageNum,
          mileageUnit: "km",
          countryOfOrigin: draft.countryOfOrigin as CountryOriginKey,
          engineType: draftEngineToConvex(draft.engineType),
          vehiclePhoto: storageId,
          status: "draft",
        },
      });

      router.push(`/inspecciones/${String(inspectionId)}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "No se pudo guardar la inspección.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={cn("mx-auto max-w-lg space-y-5 px-4 py-4", className)}
    >
      <PhotoCapture
        file={draft.vehiclePhotoFile}
        onFileChange={(f) => setDraft({ vehiclePhotoFile: f })}
        disabled={submitting}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="plate" className="text-sm font-medium text-foreground">
            Placa
          </label>
          <input
            id="plate"
            name="plate"
            type="text"
            autoCapitalize="characters"
            placeholder="MX-782-KP"
            value={draft.plate}
            onChange={(e) => setDraft({ plate: e.target.value })}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="year" className="text-sm font-medium text-foreground">
            Año
          </label>
          <input
            id="year"
            name="year"
            type="number"
            inputMode="numeric"
            placeholder="2022"
            value={draft.yearInput}
            onChange={(e) => setDraft({ yearInput: e.target.value })}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="vin" className="text-sm font-medium text-foreground">
          VIN (Número de Chasis)
        </label>
        <input
          id="vin"
          name="vin"
          type="text"
          autoCapitalize="characters"
          placeholder="3N1AB7AP0LL523491"
          value={draft.vinInput}
          onChange={(e) => setDraft({ vinInput: e.target.value })}
          className={fieldClass}
        />
        {draft.vinInput.trim().length > 0 && !vinOk ? (
          <p className="text-xs text-destructive">
            Si indicas VIN, deben ser 17 caracteres.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="brand" className="text-sm font-medium text-foreground">
            Marca
          </label>
          <div className="relative">
            <select
              id="brand"
              name="brand"
              value={draft.brand}
              onChange={(e) => setDraft({ brand: e.target.value })}
              className={cn(
                fieldClass,
                "appearance-none bg-card pr-10",
                !draft.brand ? "text-muted-foreground" : "",
              )}
            >
              <option value="">Seleccionar</option>
              {BRAND_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="model" className="text-sm font-medium text-foreground">
            Modelo
          </label>
          <input
            id="model"
            name="model"
            type="text"
            placeholder="Sentra SR"
            value={draft.model}
            onChange={(e) => setDraft({ model: e.target.value })}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="mileage" className="text-sm font-medium text-foreground">
          Kilometraje
        </label>
        <div className="relative">
          <input
            id="mileage"
            name="mileage"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="45200"
            value={draft.mileageInput}
            onChange={(e) => setDraft({ mileageInput: e.target.value })}
            className={cn(fieldClass, "pr-12")}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            km
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="country" className="text-sm font-medium text-foreground">
          País de Origen
        </label>
        <div className="relative">
          <select
            id="country"
            name="country"
            value={draft.countryOfOrigin}
            onChange={(e) =>
              setDraft({
                countryOfOrigin: e.target.value as CountryOriginKey | "",
              })
            }
            className={cn(
              fieldClass,
              "appearance-none bg-card pr-10",
              draft.countryOfOrigin === "" ? "text-muted-foreground" : "",
            )}
          >
            <option value="">Seleccionar</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <span id="engine-label" className="text-sm font-medium text-foreground">
          Tipo de Motor
        </span>
        <ToggleButtonGroup
          labelId="engine-label"
          variant="outline"
          value={draft.engineType}
          onChange={(engineType) => setDraft({ engineType })}
          options={[
            {
              value: "combustion" as const,
              label: "Combustión",
              icon: <Fuel className="text-inherit" />,
            },
            {
              value: "electrico" as const,
              label: "Eléctrico",
              icon: <Plug className="text-inherit" />,
            },
          ]}
        />
      </div>

      {submitError ? (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="pt-2">
        <Button
          type="submit"
          disabled={!isValid || submitting}
          size="lg"
          className="h-12 w-full rounded-2xl border-0 bg-[#FF8C00] text-base font-semibold text-white hover:bg-[#FF8C00]/90"
        >
          Iniciar Inspección
          <Play className="size-5 fill-current" data-icon="inline-end" />
        </Button>
      </div>
    </form>
  );
}
