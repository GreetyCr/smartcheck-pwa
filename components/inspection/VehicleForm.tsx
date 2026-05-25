"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BatteryCharging,
  ChevronDown,
  Fuel,
  Loader2,
  Play,
  Plug,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUnifiedDraftFlow } from "@/lib/featureFlags";
import { Button } from "@/components/ui/button";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { PhotoCapture } from "@/components/ui/PhotoCapture";
import { useInspectionWizard } from "@/components/inspection/InspectionWizard";
import { formControlValue } from "@/lib/browser-confirm";
import { uploadFileToConvexStorage } from "@/lib/convex-storage";
import {
  BRAND_OPTIONS,
  COUNTRY_OPTIONS,
  draftEngineToConvex,
  isValidVinOptional17,
  parseMileage,
  parseYear,
  plateAlphanumericCore,
  resolvePrimaryVehicleId,
} from "@/lib/vehicle-form";
import type {
  CaptureSource,
  CountryOriginKey,
  DraftCombustionFuel,
  DraftEngineCategory,
  MileageUnitKey,
  SellerTypeKey,
} from "@/types/inspection-draft";
import { cn } from "@/lib/utils";
import { DashboardPageSkeleton } from "@/components/layout/DashboardPageSkeleton";
import {
  compressVehiclePhoto,
  CompressVehiclePhotoError,
} from "@/lib/images/compressVehiclePhoto";
import type { InspectionDraft } from "@/types/inspection-draft";

const fieldClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30";

type VehicleWizardPhotoKey = keyof Pick<
  InspectionDraft,
  | "vehiclePhotoFrontFile"
  | "vehiclePhotoSideLeftFile"
  | "vehiclePhotoSideRightFile"
  | "vehiclePhotoRearFile"
  | "photoDekraFile"
  | "photoPlateFile"
  | "photoMarchamoFile"
  | "photoVinStickerFile"
>;

async function uploadOne(
  generateUploadUrl: () => Promise<string>,
  file: File,
): Promise<Id<"_storage">> {
  const postUrl = await generateUploadUrl();
  return uploadFileToConvexStorage(postUrl, file);
}

export function VehicleForm({ className }: { className?: string }) {
  const router = useRouter();
  const unifiedDraft = useUnifiedDraftFlow();
  const { draft, setDraft } = useInspectionWizard();
  const createDraft = useMutation(api.inspections.createDraft);
  const generateUploadUrl = useMutation(api.inspections.generateUploadUrl);
  const patchInspection = useMutation(api.inspections.patch);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoPickError, setPhotoPickError] = useState<string | null>(null);
  /** Por slot: solo el último pick gana si el usuario cambia foto antes de que termine la compresión. */
  const photoPickGen = useRef<Partial<Record<VehicleWizardPhotoKey, number>>>({});

  const onVehiclePhotoPicked = useCallback(
    async (key: VehicleWizardPhotoKey, file: File | null) => {
      const nextGen = (photoPickGen.current[key] ?? 0) + 1;
      photoPickGen.current[key] = nextGen;

      if (!file) {
        setDraft({ [key]: null } as Partial<InspectionDraft>);
        setPhotoPickError(null);
        return;
      }
      try {
        const { file: compressed } = await compressVehiclePhoto(file);
        if (photoPickGen.current[key] !== nextGen) {
          return;
        }
        setDraft({ [key]: compressed } as Partial<InspectionDraft>);
        setPhotoPickError(null);
      } catch (err) {
        if (photoPickGen.current[key] !== nextGen) {
          return;
        }
        if (err instanceof CompressVehiclePhotoError) {
          setPhotoPickError(err.message);
        } else {
          setPhotoPickError(
            err instanceof Error
              ? err.message
              : "No se pudo procesar la imagen.",
          );
        }
      }
    },
    [setDraft],
  );

  useEffect(() => {
    if (
      !draft.captureSource ||
      draft.clientName.trim().length < 3 ||
      draft.sellerType === ""
    ) {
      router.replace("/inspecciones/nueva/cliente");
    }
  }, [draft.captureSource, draft.clientName, draft.sellerType, router]);

  const yearNum = parseYear(draft.yearInput);
  const mileageNum = parseMileage(draft.mileageInput);
  const vinNorm = draft.vinInput.trim().toUpperCase();
  const plateCore = plateAlphanumericCore(draft.plate);
  const hasVin17 = /^[A-HJ-NPR-Z0-9]{17}$/.test(vinNorm);
  const hasPlateOk = /^[A-Z0-9]{6,7}$/.test(plateCore);
  const vinFormatOk = isValidVinOptional17(draft.vinInput);
  const idOk = hasVin17 || hasPlateOk;

  const photosOk =
    draft.vehiclePhotoFrontFile !== null &&
    draft.vehiclePhotoSideLeftFile !== null &&
    draft.vehiclePhotoSideRightFile !== null &&
    draft.vehiclePhotoRearFile !== null;

  const isValid = useMemo(() => {
    const yearOk = yearNum !== null;
    const modelOk = draft.model.trim().length >= 2;
    const brandOk = draft.brand.trim().length > 0;
    const countryOk = draft.countryOfOrigin !== "";
    const mileageOk = mileageNum !== null;
    const engineOk =
      draft.engineCategory !== "combustion" ||
      draft.combustionFuel === "gasolina" ||
      draft.combustionFuel === "diesel" ||
      draft.combustionFuel === "gas_lp";
    return (
      photosOk &&
      idOk &&
      yearOk &&
      modelOk &&
      brandOk &&
      countryOk &&
      mileageOk &&
      engineOk &&
      vinFormatOk
    );
  }, [
    draft.brand,
    draft.model,
    draft.countryOfOrigin,
    draft.engineCategory,
    draft.combustionFuel,
    draft.vinInput,
    mileageNum,
    yearNum,
    photosOk,
    idOk,
    vinFormatOk,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !isValid ||
      !yearNum ||
      !mileageNum ||
      !draft.vehiclePhotoFrontFile ||
      !draft.vehiclePhotoSideLeftFile ||
      !draft.vehiclePhotoSideRightFile ||
      !draft.vehiclePhotoRearFile
    ) {
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      const newClientId = unifiedDraft ? crypto.randomUUID() : undefined;
      const inspectionId = (await createDraft()) as Id<"inspections">;
      const source = draft.captureSource as CaptureSource;
      const sellerType = draft.sellerType as SellerTypeKey;

      const gen = () => generateUploadUrl();

      /** Las 4 ángulos obligatorios en paralelo (antes en serie → ~4× latencia). */
      const [
        vehiclePhotoFront,
        vehiclePhotoSideLeft,
        vehiclePhotoSideRight,
        vehiclePhotoRear,
      ] = await Promise.all([
        uploadOne(gen, draft.vehiclePhotoFrontFile),
        uploadOne(gen, draft.vehiclePhotoSideLeftFile),
        uploadOne(gen, draft.vehiclePhotoSideRightFile),
        uploadOne(gen, draft.vehiclePhotoRearFile),
      ]);

      /** Opcionales también en paralelo si existen. */
      const [photoDekra, photoPlate, photoMarchamo, photoVinSticker] =
        await Promise.all([
          draft.photoDekraFile
            ? uploadOne(gen, draft.photoDekraFile)
            : Promise.resolve(undefined),
          draft.photoPlateFile
            ? uploadOne(gen, draft.photoPlateFile)
            : Promise.resolve(undefined),
          draft.photoMarchamoFile
            ? uploadOne(gen, draft.photoMarchamoFile)
            : Promise.resolve(undefined),
          draft.photoVinStickerFile
            ? uploadOne(gen, draft.photoVinStickerFile)
            : Promise.resolve(undefined),
        ]);

      const ids = resolvePrimaryVehicleId(draft.plate, draft.vinInput);

      const mileageUnit = draft.mileageUnit as MileageUnitKey;

      await patchInspection({
        id: inspectionId,
        patch: {
          ...(newClientId ? { clientId: newClientId } : {}),
          clientName: draft.clientName.trim(),
          clientPhone: draft.clientPhone.trim(),
          clientEmail: draft.clientEmail.trim() || undefined,
          sellerType,
          sellerNote: draft.sellerNote.trim() || undefined,
          captureSource: source,
          outOfGamFee: draft.isInGAM ? 0 : draft.outOfGamFee,
          vehicleBrand: draft.brand.trim(),
          vehicleModel: draft.model.trim(),
          vehicleYear: yearNum,
          identifierType: ids.identifierType,
          identifier: ids.identifier,
          vin: ids.vin,
          plateNumber: ids.plateNumber,
          mileage: mileageNum,
          mileageUnit,
          countryOfOrigin: draft.countryOfOrigin as CountryOriginKey,
          engineType: draftEngineToConvex({
            engineCategory: draft.engineCategory,
            combustionFuel: draft.combustionFuel,
          }),
          vehiclePhoto: vehiclePhotoFront,
          vehiclePhotoFront,
          vehiclePhotoSideLeft,
          vehiclePhotoSideRight,
          vehiclePhotoRear,
          photoDekra,
          photoPlate,
          platePhotoNote: draft.platePhotoNote.trim() || undefined,
          photoMarchamo,
          photoVinSticker,
          status: "draft",
        },
      });

      const nextPath =
        newClientId !== undefined
          ? `/inspecciones/${newClientId}`
          : `/inspecciones/${String(inspectionId)}`;
      router.push(nextPath);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "No se pudo guardar la inspección.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {submitting ? (
        <div
          className="fixed inset-0 z-100 flex flex-col bg-background/95 backdrop-blur-sm"
          role="alertdialog"
          aria-busy
          aria-label="Creando inspección"
        >
          <DashboardPageSkeleton variant="form" className="min-h-0 flex-1 bg-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-2 px-4 text-center">
            <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-semibold text-foreground">
              Creando inspección…
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Subiendo fotos del vehículo y guardando datos. Puede tardar un poco con
              conexión móvil; no cierres la pantalla.
            </p>
          </div>
        </div>
      ) : null}
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={cn("mx-auto max-w-lg space-y-5 px-4 py-4", className)}
    >
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          Fotos del vehículo <span className="text-destructive">*</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Cuatro ángulos obligatorios: frontal, dos laterales y trasera.
        </p>
        {photoPickError ? (
          <p className="text-sm text-destructive" role="alert">
            {photoPickError}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <PhotoCapture
            file={draft.vehiclePhotoFrontFile}
            onFileChange={(f) => void onVehiclePhotoPicked("vehiclePhotoFrontFile", f)}
            disabled={submitting}
            label="Frontal"
          />
          <PhotoCapture
            file={draft.vehiclePhotoSideLeftFile}
            onFileChange={(f) =>
              void onVehiclePhotoPicked("vehiclePhotoSideLeftFile", f)
            }
            disabled={submitting}
            label="Lateral izquierdo"
          />
          <PhotoCapture
            file={draft.vehiclePhotoSideRightFile}
            onFileChange={(f) =>
              void onVehiclePhotoPicked("vehiclePhotoSideRightFile", f)
            }
            disabled={submitting}
            label="Lateral derecho"
          />
          <PhotoCapture
            file={draft.vehiclePhotoRearFile}
            onFileChange={(f) => void onVehiclePhotoPicked("vehiclePhotoRearFile", f)}
            disabled={submitting}
            label="Trasera"
          />
        </div>
      </div>

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
            placeholder="6–7 caracteres"
            value={draft.plate}
            onChange={(e) => setDraft({ plate: formControlValue(e) })}
            className={fieldClass}
          />
          <p className="text-xs text-muted-foreground">
            Opcional si ya tienes VIN (17 caracteres). Sin guiones o con guiones.
          </p>
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
            onChange={(e) => setDraft({ yearInput: formControlValue(e) })}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="vin" className="text-sm font-medium text-foreground">
          VIN (17 caracteres)
        </label>
        <input
          id="vin"
          name="vin"
          type="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={17}
          placeholder="Ej. 3VWD17FJ5HM123456"
          value={draft.vinInput}
          onChange={(e) => setDraft({ vinInput: formControlValue(e) })}
          className={fieldClass}
        />
        <p className="text-xs text-muted-foreground">
          Código único del fabricante (sin I, O ni Q). En Costa Rica los ensamblados
          locales suelen usar prefijos WMI como 3V–37…
        </p>
        {draft.vinInput.trim().length > 0 && !vinFormatOk ? (
          <p className="text-xs text-destructive">
            Si indicas VIN, deben ser 17 caracteres válidos (estándar internacional).
          </p>
        ) : null}
        {!idOk && vinFormatOk ? (
          <p className="text-xs text-destructive">
            Indica un VIN válido (17 caracteres) o una placa de 6–7 caracteres.
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
              onChange={(e) => setDraft({ brand: formControlValue(e) })}
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
            onChange={(e) => setDraft({ model: formControlValue(e) })}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="mileage" className="text-sm font-medium text-foreground">
          Kilometraje / Millaje
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
            onChange={(e) => setDraft({ mileageInput: formControlValue(e) })}
            className={cn(fieldClass, "pr-14")}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            {draft.mileageUnit === "millas" ? "mi" : "km"}
          </span>
        </div>
        <span id="mileage-unit-label" className="sr-only">
          Unidad de odómetro
        </span>
        <ToggleButtonGroup
          labelId="mileage-unit-label"
          variant="outline"
          className="mt-2"
          value={draft.mileageUnit}
          onChange={(mileageUnit) =>
            setDraft({ mileageUnit: mileageUnit as MileageUnitKey })
          }
          options={[
            { value: "km" as const, label: "Kilómetros (km)" },
            { value: "millas" as const, label: "Millas (mi)" },
          ]}
        />
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
                countryOfOrigin: formControlValue(e) as CountryOriginKey | "",
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
          Tipo de motor
        </span>
        <ToggleButtonGroup
          labelId="engine-label"
          variant="outline"
          value={draft.engineCategory}
          onChange={(engineCategory) =>
            setDraft({
              engineCategory: engineCategory as DraftEngineCategory,
              combustionFuel:
                engineCategory === "combustion" ? draft.combustionFuel : "",
            })
          }
          options={[
            {
              value: "combustion" as const,
              label: "Combustión",
              icon: <Fuel className="text-inherit" />,
            },
            {
              value: "hibrido" as const,
              label: "Híbrido",
              icon: <BatteryCharging className="text-inherit" />,
            },
            {
              value: "electrico" as const,
              label: "Eléctrico",
              icon: <Plug className="text-inherit" />,
            },
          ]}
        />
        {draft.engineCategory === "combustion" ? (
          <div className="space-y-1.5 pt-2">
            <span
              id="engine-fuel-label"
              className="text-sm font-medium text-foreground"
            >
              Combustible
            </span>
            <ToggleButtonGroup
              labelId="engine-fuel-label"
              variant="outline"
              value={draft.combustionFuel}
              onChange={(combustionFuel) =>
                setDraft({
                  combustionFuel: combustionFuel as DraftCombustionFuel,
                })
              }
              options={[
                { value: "gasolina" as const, label: "Gasolina" },
                { value: "diesel" as const, label: "Diésel" },
                { value: "gas_lp" as const, label: "Gas LP" },
              ]}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
        <p className="text-sm font-medium text-foreground">
          Documentación adicional <span className="font-normal text-muted-foreground">(opcional)</span>
        </p>
        <PhotoCapture
          file={draft.photoDekraFile}
          onFileChange={(f) => void onVehiclePhotoPicked("photoDekraFile", f)}
          disabled={submitting}
          label="Foto Dekra"
        />
        <PhotoCapture
          file={draft.photoPlateFile}
          onFileChange={(f) => void onVehiclePhotoPicked("photoPlateFile", f)}
          disabled={submitting}
          label="Foto de placa"
        />
        <div className="space-y-1.5">
          <label htmlFor="plate-photo-note" className="text-sm font-medium text-foreground">
            Texto junto a placa <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="plate-photo-note"
            name="platePhotoNote"
            type="text"
            placeholder="Ej. observaciones sobre la placa"
            value={draft.platePhotoNote}
            onChange={(e) =>
              setDraft({ platePhotoNote: formControlValue(e) })
            }
            className={fieldClass}
          />
        </div>
        <PhotoCapture
          file={draft.photoMarchamoFile}
          onFileChange={(f) => void onVehiclePhotoPicked("photoMarchamoFile", f)}
          disabled={submitting}
          label="Foto de marchamo"
        />
        <PhotoCapture
          file={draft.photoVinStickerFile}
          onFileChange={(f) =>
            void onVehiclePhotoPicked("photoVinStickerFile", f)
          }
          disabled={submitting}
          label="Foto de VIN (etiqueta)"
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
    </>
  );
}
