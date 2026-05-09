"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Fuel, Plug, Save } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { PhotoCapture } from "@/components/ui/PhotoCapture";
import { DashboardPageSkeleton } from "@/components/layout/DashboardPageSkeleton";
import { formControlValue } from "@/lib/browser-confirm";
import { uploadFileToConvexStorage } from "@/lib/convex-storage";
import {
  isValidPhoneCr8Digits,
  normalizePhoneDigitsCr,
} from "@/lib/phone-cr";
import type {
  CaptureSource,
  CountryOriginKey,
  DraftEngineUi,
  MileageUnitKey,
  SellerTypeKey,
} from "@/types/inspection-draft";
import {
  COUNTRY_OPTIONS,
  draftEngineToConvex,
  isValidVinOptional17,
  parseMileage,
  parseYear,
  plateAlphanumericCore,
  resolvePrimaryVehicleId,
  isValidOptionalEmail,
} from "@/lib/vehicle-form";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30";

async function uploadOne(
  generateUploadUrl: () => Promise<string>,
  file: File,
): Promise<Id<"_storage">> {
  const postUrl = await generateUploadUrl();
  return uploadFileToConvexStorage(postUrl, file);
}

function normalizeCountryForSelect(
  raw: string | undefined,
): CountryOriginKey | "" {
  const allowed: CountryOriginKey[] = [
    "usa",
    "nacional",
    "panama",
    "korea",
    "otros",
  ];
  if (!raw) return "";
  return allowed.includes(raw as CountryOriginKey)
    ? (raw as CountryOriginKey)
    : "otros";
}

const CAPTURE_ORDER: CaptureSource[] = [
  "publicidad",
  "tiktok",
  "buscador",
  "recompra",
  "referido",
];

type Props = { inspectionId: Id<"inspections"> };

export function InspectionCabeceraScreen({ inspectionId }: Props) {
  const router = useRouter();
  const payload = useQuery(api.inspections.getCabeceraEdit, { id: inspectionId });
  const generateUploadUrl = useMutation(api.inspections.generateUploadUrl);
  const patchInspection = useMutation(api.inspections.patch);

  const seeded = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [captureSource, setCaptureSource] = useState<CaptureSource | "">("");
  const [sellerType, setSellerType] = useState<SellerTypeKey | "">("");
  const [sellerNote, setSellerNote] = useState("");

  const [vehiclePhotoFrontFile, setVehiclePhotoFrontFile] = useState<File | null>(
    null,
  );
  const [vehiclePhotoSideLeftFile, setVehiclePhotoSideLeftFile] =
    useState<File | null>(null);
  const [vehiclePhotoSideRightFile, setVehiclePhotoSideRightFile] =
    useState<File | null>(null);
  const [vehiclePhotoRearFile, setVehiclePhotoRearFile] = useState<File | null>(
    null,
  );
  const [photoDekraFile, setPhotoDekraFile] = useState<File | null>(null);
  const [photoPlateFile, setPhotoPlateFile] = useState<File | null>(null);
  const [photoMarchamoFile, setPhotoMarchamoFile] = useState<File | null>(null);
  const [photoVinStickerFile, setPhotoVinStickerFile] = useState<File | null>(
    null,
  );
  const [platePhotoNote, setPlatePhotoNote] = useState("");
  const [plate, setPlate] = useState("");
  const [yearInput, setYearInput] = useState("");
  const [vinInput, setVinInput] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [mileageInput, setMileageInput] = useState("");
  const [mileageUnit, setMileageUnit] = useState<MileageUnitKey>("km");
  const [countryOfOrigin, setCountryOfOrigin] = useState<CountryOriginKey | "">(
    "",
  );
  const [engineType, setEngineType] = useState<DraftEngineUi>("combustion");

  useEffect(() => {
    if (!payload || seeded.current) return;
    const ins = payload.inspection;
    seeded.current = true;

    setClientName(ins.clientName ?? "");
    setClientPhone(ins.clientPhone ?? "");
    setClientEmail(ins.clientEmail ?? "");
    setCaptureSource((ins.captureSource as CaptureSource) ?? "");
    setSellerType((ins.sellerType as SellerTypeKey) ?? "");
    setSellerNote(ins.sellerNote ?? "");

    const idPlate =
      ins.identifierType === "placa" && ins.identifier
        ? ins.identifier
        : ins.plateNumber ?? "";
    setPlate(idPlate);
    const vinShow =
      ins.vin ??
      (ins.identifierType === "vin" && ins.identifier ? ins.identifier : "");
    setVinInput(vinShow);
    setYearInput(ins.vehicleYear != null ? String(ins.vehicleYear) : "");
    setBrand(ins.vehicleBrand ?? "");
    setModel(ins.vehicleModel ?? "");
    setMileageInput(ins.mileage != null ? String(ins.mileage) : "");
    setMileageUnit((ins.mileageUnit as MileageUnitKey) ?? "km");
    setCountryOfOrigin(normalizeCountryForSelect(ins.countryOfOrigin));
    setEngineType(ins.engineType === "electrico" ? "electrico" : "combustion");
    setPlatePhotoNote(ins.platePhotoNote ?? "");
  }, [payload]);

  const phoneDigits = normalizePhoneDigitsCr(clientPhone);
  const yearNum = parseYear(yearInput);
  const mileageNum = parseMileage(mileageInput);
  const vinNorm = vinInput.trim().toUpperCase();
  const hasVin17 = /^[A-HJ-NPR-Z0-9]{17}$/.test(vinNorm);
  const hasPlateOk = /^[A-Z0-9]{6,7}$/.test(plateAlphanumericCore(plate));
  const vinFormatOk = isValidVinOptional17(vinInput);
  const idOk = hasVin17 || hasPlateOk;

  const photosOk =
    Boolean(payload?.photoUrls.front || vehiclePhotoFrontFile) &&
    Boolean(payload?.photoUrls.sideLeft || vehiclePhotoSideLeftFile) &&
    Boolean(payload?.photoUrls.sideRight || vehiclePhotoSideRightFile) &&
    Boolean(payload?.photoUrls.rear || vehiclePhotoRearFile);

  const isValid = useMemo(() => {
    const nameOk = clientName.trim().length >= 3;
    const phoneOk = isValidPhoneCr8Digits(phoneDigits);
    const emailOk = isValidOptionalEmail(clientEmail);
    const sourceOk = captureSource !== "";
    const sellerOk = sellerType !== "";
    const yearOk = yearNum !== null;
    const modelOk = model.trim().length >= 2;
    const brandOk = brand.trim().length > 0;
    const countryOk = countryOfOrigin !== "";
    const mileageOk = mileageNum !== null;
    return (
      nameOk &&
      phoneOk &&
      emailOk &&
      sourceOk &&
      sellerOk &&
      photosOk &&
      idOk &&
      yearOk &&
      modelOk &&
      brandOk &&
      countryOk &&
      mileageOk &&
      vinFormatOk
    );
  }, [
    clientName,
    phoneDigits,
    clientEmail,
    captureSource,
    sellerType,
    photosOk,
    idOk,
    mileageNum,
    yearNum,
    model,
    brand,
    countryOfOrigin,
    vinFormatOk,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (
        !isValid ||
        !payload ||
        !yearNum ||
        !mileageNum
      ) {
        return;
      }
      setSubmitError(null);
      setSubmitting(true);
      try {
        const gen = () => generateUploadUrl();
        const ins = payload.inspection;

        const uploadIfFile = async (
          file: File | null,
          previousId: Id<"_storage"> | undefined,
        ): Promise<Id<"_storage"> | undefined> => {
          if (file) return uploadOne(gen, file);
          return previousId;
        };

        const [
          vehiclePhotoFront,
          vehiclePhotoSideLeft,
          vehiclePhotoSideRight,
          vehiclePhotoRear,
        ] = await Promise.all([
          uploadIfFile(
            vehiclePhotoFrontFile,
            ins.vehiclePhotoFront ?? ins.vehiclePhoto ?? undefined,
          ),
          uploadIfFile(vehiclePhotoSideLeftFile, ins.vehiclePhotoSideLeft ?? undefined),
          uploadIfFile(
            vehiclePhotoSideRightFile,
            ins.vehiclePhotoSideRight ?? undefined,
          ),
          uploadIfFile(vehiclePhotoRearFile, ins.vehiclePhotoRear ?? undefined),
        ]);

        if (
          !vehiclePhotoFront ||
          !vehiclePhotoSideLeft ||
          !vehiclePhotoSideRight ||
          !vehiclePhotoRear
        ) {
          throw new Error("Faltan fotos obligatorias del vehículo.");
        }

        const [photoDekra, photoPlate, photoMarchamo, photoVinSticker] =
          await Promise.all([
            uploadIfFile(photoDekraFile, ins.photoDekra ?? undefined),
            uploadIfFile(photoPlateFile, ins.photoPlate ?? undefined),
            uploadIfFile(photoMarchamoFile, ins.photoMarchamo ?? undefined),
            uploadIfFile(photoVinStickerFile, ins.photoVinSticker ?? undefined),
          ]);

        const ids = resolvePrimaryVehicleId(plate, vinInput);

        await patchInspection({
          id: inspectionId,
          patch: {
            clientName: clientName.trim(),
            clientPhone: phoneDigits,
            clientEmail: clientEmail.trim() || undefined,
            captureSource: captureSource as CaptureSource,
            sellerType: sellerType as SellerTypeKey,
            sellerNote: sellerNote.trim() || undefined,
            vehicleBrand: brand.trim(),
            vehicleModel: model.trim(),
            vehicleYear: yearNum,
            identifierType: ids.identifierType,
            identifier: ids.identifier,
            vin: ids.vin,
            plateNumber: ids.plateNumber,
            mileage: mileageNum,
            mileageUnit,
            countryOfOrigin: countryOfOrigin as CountryOriginKey,
            engineType: draftEngineToConvex(engineType),
            vehiclePhoto: vehiclePhotoFront,
            vehiclePhotoFront,
            vehiclePhotoSideLeft,
            vehiclePhotoSideRight,
            vehiclePhotoRear,
            photoDekra,
            photoPlate,
            platePhotoNote: platePhotoNote.trim() || undefined,
            photoMarchamo,
            photoVinSticker,
          },
        });

        router.push(`/inspecciones/${String(inspectionId)}`);
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "No se pudo guardar los cambios.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      isValid,
      payload,
      yearNum,
      mileageNum,
      generateUploadUrl,
      vehiclePhotoFrontFile,
      vehiclePhotoSideLeftFile,
      vehiclePhotoSideRightFile,
      vehiclePhotoRearFile,
      photoDekraFile,
      photoPlateFile,
      photoMarchamoFile,
      photoVinStickerFile,
      plate,
      vinInput,
      clientName,
      phoneDigits,
      clientEmail,
      captureSource,
      sellerType,
      sellerNote,
      brand,
      model,
      mileageUnit,
      countryOfOrigin,
      engineType,
      platePhotoNote,
      patchInspection,
      inspectionId,
      router,
    ],
  );

  if (payload === undefined) {
    return <DashboardPageSkeleton variant="form" />;
  }

  if (payload === null) {
    return (
      <div className="p-6">
        <p className="text-destructive">No se encontró la inspección o sin permiso.</p>
        <Link href="/" className="mt-2 inline-block text-primary underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const pu = payload.photoUrls;

  return (
    <div className="flex min-h-dvh flex-col bg-[#F8F9FA] pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card px-2 py-3">
        <Link
          href={`/inspecciones/${inspectionId}`}
          className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-muted"
          aria-label="Volver"
        >
          <ArrowLeft className="size-6" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-base font-bold text-primary">Editar cabecera del informe</h1>
          <p className="text-xs text-muted-foreground">
            Cliente, vehículo y fotos del reporte
          </p>
        </div>
        <span className="size-10 shrink-0" aria-hidden />
      </header>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mx-auto w-full max-w-lg flex-1 space-y-5 px-4 py-4"
      >
        <h2 className="text-lg font-bold text-primary">Cliente y contexto</h2>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ec-name">
            Nombre completo
          </label>
          <input
            id="ec-name"
            value={clientName}
            onChange={(e) => setClientName(formControlValue(e))}
            className={fieldClass}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ec-phone">
            Teléfono (8 dígitos CR)
          </label>
          <input
            id="ec-phone"
            inputMode="numeric"
            value={clientPhone}
            onChange={(e) => setClientPhone(formControlValue(e))}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ec-email">
            Correo (opcional)
          </label>
          <input
            id="ec-email"
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(formControlValue(e))}
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ec-seller">
            Origen de compra
          </label>
          <select
            id="ec-seller"
            value={sellerType}
            onChange={(e) =>
              setSellerType(formControlValue(e) as SellerTypeKey | "")
            }
            className={cn(fieldClass, "appearance-none bg-card pr-10")}
          >
            <option value="">Seleccionar</option>
            <option value="concesionaria">Concesionaria</option>
            <option value="particular">Particular</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ec-cap">
            ¿Cómo nos conoció?
          </label>
          <select
            id="ec-cap"
            value={captureSource}
            onChange={(e) =>
              setCaptureSource(formControlValue(e) as CaptureSource | "")
            }
            className={cn(fieldClass, "appearance-none bg-card pr-10")}
          >
            <option value="">Seleccionar</option>
            {CAPTURE_ORDER.map((c) => (
              <option key={c} value={c}>
                {c === "publicidad"
                  ? "Publicidad"
                  : c === "tiktok"
                    ? "TikTok"
                    : c === "buscador"
                      ? "Buscador"
                      : c === "recompra"
                        ? "Recompra"
                        : "Referido"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ec-sn">
            Nota origen (opcional)
          </label>
          <input
            id="ec-sn"
            value={sellerNote}
            onChange={(e) => setSellerNote(formControlValue(e))}
            className={fieldClass}
          />
        </div>

        <h2 className="pt-2 text-lg font-bold text-primary">Vehículo y fotos</h2>
        <p className="text-xs text-muted-foreground">
          Cuatro ángulos obligatorios. Si no cambias una foto, se mantiene la actual.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <PhotoCapture
            file={vehiclePhotoFrontFile}
            existingImageUrl={pu.front}
            onFileChange={setVehiclePhotoFrontFile}
            disabled={submitting}
            label="Frontal"
          />
          <PhotoCapture
            file={vehiclePhotoSideLeftFile}
            existingImageUrl={pu.sideLeft}
            onFileChange={setVehiclePhotoSideLeftFile}
            disabled={submitting}
            label="Lateral izquierdo"
          />
          <PhotoCapture
            file={vehiclePhotoSideRightFile}
            existingImageUrl={pu.sideRight}
            onFileChange={setVehiclePhotoSideRightFile}
            disabled={submitting}
            label="Lateral derecho"
          />
          <PhotoCapture
            file={vehiclePhotoRearFile}
            existingImageUrl={pu.rear}
            onFileChange={setVehiclePhotoRearFile}
            disabled={submitting}
            label="Trasera"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="ec-plate">
              Placa
            </label>
            <input
              id="ec-plate"
              value={plate}
              onChange={(e) => setPlate(formControlValue(e))}
              className={fieldClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="ec-year">
              Año
            </label>
            <input
              id="ec-year"
              type="number"
              inputMode="numeric"
              value={yearInput}
              onChange={(e) => setYearInput(formControlValue(e))}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ec-vin">
            VIN (17 caracteres)
          </label>
          <input
            id="ec-vin"
            value={vinInput}
            onChange={(e) => setVinInput(formControlValue(e))}
            className={fieldClass}
            maxLength={17}
          />
          {vinInput.trim().length > 0 && !vinFormatOk ? (
            <p className="text-xs text-destructive">
              Si indicas VIN, deben ser 17 caracteres válidos.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="ec-brand">
              Marca
            </label>
            <input
              id="ec-brand"
              value={brand}
              onChange={(e) => setBrand(formControlValue(e))}
              className={fieldClass}
              placeholder="Ej. Toyota"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="ec-model">
              Modelo
            </label>
            <input
              id="ec-model"
              value={model}
              onChange={(e) => setModel(formControlValue(e))}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ec-mileage">
            Kilometraje / millaje
          </label>
          <input
            id="ec-mileage"
            type="number"
            inputMode="numeric"
            value={mileageInput}
            onChange={(e) => setMileageInput(formControlValue(e))}
            className={cn(fieldClass, "pr-14")}
          />
          <span id="ec-mile-unit" className="sr-only">
            Unidad de odómetro
          </span>
          <ToggleButtonGroup
            labelId="ec-mile-unit"
            variant="outline"
            className="mt-2"
            value={mileageUnit}
            onChange={(u) => setMileageUnit(u as MileageUnitKey)}
            options={[
              { value: "km", label: "km" },
              { value: "millas", label: "mi" },
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ec-country">
            País de origen
          </label>
          <select
            id="ec-country"
            value={countryOfOrigin}
            onChange={(e) =>
              setCountryOfOrigin(formControlValue(e) as CountryOriginKey | "")
            }
            className={cn(fieldClass, "appearance-none bg-card pr-10")}
          >
            <option value="">Seleccionar</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <span id="ec-engine" className="text-sm font-medium text-foreground">
            Tipo de motor
          </span>
          <ToggleButtonGroup
            labelId="ec-engine"
            variant="outline"
            value={engineType}
            onChange={(v) => setEngineType(v as DraftEngineUi)}
            options={[
              {
                value: "combustion",
                label: "Combustión",
                icon: <Fuel className="text-inherit" />,
              },
              {
                value: "electrico",
                label: "Eléctrico",
                icon: <Plug className="text-inherit" />,
              },
            ]}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
          <p className="text-sm font-medium text-foreground">Documentación adicional</p>
          <PhotoCapture
            file={photoDekraFile}
            existingImageUrl={pu.dekra}
            onFileChange={setPhotoDekraFile}
            disabled={submitting}
            label="Dekra"
          />
          <PhotoCapture
            file={photoPlateFile}
            existingImageUrl={pu.plate}
            onFileChange={setPhotoPlateFile}
            disabled={submitting}
            label="Foto de placa"
          />
          <input
            value={platePhotoNote}
            onChange={(e) => setPlatePhotoNote(formControlValue(e))}
            className={fieldClass}
            placeholder="Nota junto a placa (opcional)"
          />
          <PhotoCapture
            file={photoMarchamoFile}
            existingImageUrl={pu.marchamo}
            onFileChange={setPhotoMarchamoFile}
            disabled={submitting}
            label="Marchamo"
          />
          <PhotoCapture
            file={photoVinStickerFile}
            existingImageUrl={pu.vinSticker}
            onFileChange={setPhotoVinStickerFile}
            disabled={submitting}
            label="VIN (etiqueta)"
          />
        </div>

        {submitError ? (
          <p className="text-sm text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!isValid || submitting}
          size="lg"
          className="h-12 w-full gap-2 rounded-2xl bg-[#1E3A5F] text-base font-semibold text-white hover:bg-[#1E3A5F]/90"
        >
          <Save className="size-5" />
          {submitting ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
    </div>
  );
}
