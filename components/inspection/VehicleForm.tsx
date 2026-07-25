"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useSync } from "@/contexts/SyncContext";
import { parseDigitsToAmount } from "@/lib/amount-input";
import { saveUnifiedWizardDraft } from "@/lib/offline/saveUnifiedWizardDraft";
import { Button } from "@/components/ui/button";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { PhotoCapture } from "@/components/ui/PhotoCapture";
import { useInspectionWizard } from "@/components/inspection/InspectionWizard";
import { formControlValue, browserAlert } from "@/lib/browser-confirm";
import { uploadFileToConvexStorage } from "@/lib/convex-storage";
import {
  BRAND_OPTIONS,
  COUNTRY_OPTIONS,
  draftEngineToConvex,
  parseMileage,
  parseYear,
  resolvePrimaryVehicleId,
} from "@/lib/vehicle-form";
import type {
  CaptureSource,
  CountryOriginKey,
  CostaRicaProvinceKey,
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
import {
  scrollToFirstWizardField,
  WizardFieldWrap,
} from "@/lib/wizard-form-wrap";
import { validateVehicleWizardForm } from "@/lib/vehicle-wizard-validation";
import {
  clampInspectionStartAtLocal,
  fromDatetimeLocalValue,
  isInspectionStartAtInFuture,
  toDatetimeLocalValue,
} from "@/lib/datetime-local";

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
  | "photoVinSticker2File"
  | "photoMileageFile"
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
  const { refreshPendingCount, syncNow, isOnline } = useSync();
  const { draft, setDraft } = useInspectionWizard();
  const createDraft = useMutation(api.inspections.createDraft);
  const generateUploadUrl = useMutation(api.inspections.generateUploadUrl);
  const patchInspection = useMutation(api.inspections.patch);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoPickError, setPhotoPickError] = useState<string | null>(null);
  const [invalidKeys, setInvalidKeys] = useState<Set<string>>(new Set());
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validation = validateVehicleWizardForm({ draft });
    if (!validation.ok) {
      const keys = new Set(validation.errors.map((err) => err.key));
      setInvalidKeys(keys);
      browserAlert(
        validation.errors.length > 1
          ? `${validation.errors[0]?.message ?? "Revisa el formulario."} (${validation.errors.length} campos pendientes)`
          : (validation.errors[0]?.message ?? "Revisa el formulario."),
      );
      const first = validation.errors[0]?.key;
      if (first) scrollToFirstWizardField(first);
      return;
    }
    setInvalidKeys(new Set());

    if (isInspectionStartAtInFuture(draft.inspectionStartAtLocal)) {
      const clamped = clampInspectionStartAtLocal(draft.inspectionStartAtLocal);
      setDraft({ inspectionStartAtLocal: clamped });
      browserAlert(
        "La hora de inicio no puede ser posterior a la hora actual. Ajustala e intentá de nuevo.",
      );
      return;
    }

    if (
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
      if (!unifiedDraft && !isOnline) {
        setSubmitError(
          "Sin conexión. Reconectá para crear la inspección o usá el flujo local-first (flag unificado).",
        );
        return;
      }

      if (unifiedDraft) {
        const clientId = crypto.randomUUID();
        await saveUnifiedWizardDraft({
          clientId,
          draft,
          yearNum,
          mileageNum,
        });
        await refreshPendingCount();
        if (isOnline) {
          void syncNow();
        }
        router.push(`/inspecciones/${clientId}`);
        return;
      }

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
      const [
        photoDekra,
        photoPlate,
        photoMarchamo,
        photoVinSticker,
        photoVinSticker2,
        photoMileage,
      ] = await Promise.all([
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
        draft.photoVinSticker2File
          ? uploadOne(gen, draft.photoVinSticker2File)
          : Promise.resolve(undefined),
        draft.photoMileageFile
          ? uploadOne(gen, draft.photoMileageFile)
          : Promise.resolve(undefined),
      ]);

      const ids = resolvePrimaryVehicleId(draft.plate, draft.vinInput);

      const mileageUnit = draft.mileageUnit as MileageUnitKey;
      const inspectionStartAt = fromDatetimeLocalValue(
        draft.inspectionStartAtLocal,
      );

      await patchInspection({
        id: inspectionId,
        patch: {
          clientName: draft.clientName.trim(),
          clientPhone: draft.clientPhone.trim(),
          clientEmail: draft.clientEmail.trim() || undefined,
          sellerType,
          sellerNote: draft.sellerNote.trim() || undefined,
          captureSource: source,
          inGam: draft.inGam === "si" || draft.inGam === "no" ? draft.inGam : undefined,
          province:
            draft.province !== ""
              ? (draft.province as CostaRicaProvinceKey)
              : undefined,
          outOfGamFee:
            draft.inGam === "no"
              ? parseDigitsToAmount(draft.outOfGamFeeInput)
              : undefined,
          vehicleBrand: draft.brand.trim(),
          vehicleModel: draft.model.trim(),
          vehicleYear: yearNum,
          identifierType: ids.identifierType,
          identifier: ids.identifier,
          vin: ids.vin,
          plateNumber: ids.plateNumber,
          mileage: mileageNum,
          mileageUnit,
          inspectionStartAt,
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
          photoVinSticker2,
          photoMileage,
          status: "draft",
        },
      });

      const nextPath = `/inspecciones/${String(inspectionId)}`;
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
      <WizardFieldWrap fieldId="vehiclePhotos" invalid={invalidKeys.has("vehiclePhotos")}>
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
      </WizardFieldWrap>

      <div className="grid grid-cols-2 gap-3">
        <WizardFieldWrap fieldId="vehicleId" invalid={invalidKeys.has("vehicleId")}>
        <div className="space-y-1.5">
          <label htmlFor="plate" className="text-sm font-medium text-foreground">
            Placa
          </label>
          <input
            id="plate"
            name="plate"
            type="text"
            autoCapitalize="characters"
            placeholder="6–8 caracteres"
            value={draft.plate}
            onChange={(e) => setDraft({ plate: formControlValue(e) })}
            className={fieldClass}
          />
          <p className="text-xs text-muted-foreground">
            Opcional si ya tienes VIN (17 caracteres). Sin guiones o con guiones.
          </p>
        </div>
        </WizardFieldWrap>
        <WizardFieldWrap fieldId="year" invalid={invalidKeys.has("year")}>
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
        </WizardFieldWrap>
      </div>

      <WizardFieldWrap fieldId="vin" invalid={invalidKeys.has("vin") || invalidKeys.has("vehicleId")}>
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
      </div>
      </WizardFieldWrap>

      <div className="grid grid-cols-2 gap-3">
        <WizardFieldWrap fieldId="brand" invalid={invalidKeys.has("brand")}>
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
        </WizardFieldWrap>
        <WizardFieldWrap fieldId="model" invalid={invalidKeys.has("model")}>
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
        </WizardFieldWrap>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="inspection-start-at"
          className="text-sm font-medium text-foreground"
        >
          Fecha y hora de inicio
        </label>
        <input
          id="inspection-start-at"
          name="inspectionStartAt"
          type="datetime-local"
          max={toDatetimeLocalValue(Date.now())}
          value={draft.inspectionStartAtLocal}
          onChange={(e) => {
            const next = clampInspectionStartAtLocal(formControlValue(e));
            setDraft({ inspectionStartAtLocal: next });
          }}
          className={fieldClass}
        />
        <p className="text-xs text-muted-foreground">
          Aparece en el informe. No puede ser posterior a la hora actual.
        </p>
      </div>

      <WizardFieldWrap fieldId="mileage" invalid={invalidKeys.has("mileage")}>
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
        <PhotoCapture
          file={draft.photoMileageFile}
          onFileChange={(f) => void onVehiclePhotoPicked("photoMileageFile", f)}
          disabled={submitting}
          label="Foto de kilometraje"
          className="mt-3"
        />
      </div>
      </WizardFieldWrap>

      <WizardFieldWrap fieldId="country" invalid={invalidKeys.has("country")}>
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
      </WizardFieldWrap>

      <WizardFieldWrap fieldId="combustionFuel" invalid={invalidKeys.has("combustionFuel")}>
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
      </WizardFieldWrap>

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
        <div className="space-y-2 rounded-xl border border-border/80 bg-background/60 p-3">
          <div>
            <p className="text-sm font-semibold text-foreground">VIN (etiqueta)</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dos fotos del VIN: etiqueta y otra vista (ambas van al informe).
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PhotoCapture
              file={draft.photoVinStickerFile}
              onFileChange={(f) =>
                void onVehiclePhotoPicked("photoVinStickerFile", f)
              }
              disabled={submitting}
              label="VIN — foto 1"
            />
            <PhotoCapture
              file={draft.photoVinSticker2File}
              onFileChange={(f) =>
                void onVehiclePhotoPicked("photoVinSticker2File", f)
              }
              disabled={submitting}
              label="VIN — foto 2"
            />
          </div>
        </div>
      </div>

      {submitError ? (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      ) : null}

      {unifiedDraft && !isOnline ? (
        <p className="text-xs text-muted-foreground">
          Sin red: la inspección se guardará en este dispositivo y se sincronizará al
          reconectar.
        </p>
      ) : null}

      <div className="pt-2">
        <Button
          type="submit"
          disabled={submitting}
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
