import type { InspectionDraft } from "@/types/inspection-draft";
import {
  isValidOptionalEmail,
  isValidPlateCr,
  isValidVinOptional17,
  parseMileage,
  parseYear,
} from "@/lib/vehicle-form";
import {
  isValidPhoneCr8Digits,
  normalizePhoneDigitsCr,
} from "@/lib/phone-cr";
import type { CaptureSource, SellerTypeKey } from "@/types/inspection-draft";

export type WizardValidationError = { key: string; message: string };

export type VehicleWizardValidationInput = {
  draft: Pick<
    InspectionDraft,
    | "plate"
    | "vinInput"
    | "yearInput"
    | "brand"
    | "model"
    | "mileageInput"
    | "countryOfOrigin"
    | "engineCategory"
    | "combustionFuel"
    | "vehiclePhotoFrontFile"
    | "vehiclePhotoSideLeftFile"
    | "vehiclePhotoSideRightFile"
    | "vehiclePhotoRearFile"
  >;
  /** Cabecera editada: fotos ya guardadas en servidor cuentan como OK. */
  photosOk?: boolean;
};

export function validateVehicleWizardForm(
  input: VehicleWizardValidationInput,
): { ok: boolean; errors: WizardValidationError[] } {
  const { draft } = input;
  const errors: WizardValidationError[] = [];

  const photosOk =
    input.photosOk ??
    (draft.vehiclePhotoFrontFile !== null &&
      draft.vehiclePhotoSideLeftFile !== null &&
      draft.vehiclePhotoSideRightFile !== null &&
      draft.vehiclePhotoRearFile !== null);

  if (!photosOk) {
    errors.push({
      key: "vehiclePhotos",
      message: "Agrega las cuatro fotos obligatorias del vehículo.",
    });
  }

  const vinFormatOk = isValidVinOptional17(draft.vinInput);
  if (!vinFormatOk) {
    errors.push({
      key: "vin",
      message:
        "Si indicas VIN, deben ser 17 caracteres válidos (estándar internacional).",
    });
  }

  const hasVin17 =
    draft.vinInput.trim().length > 0 &&
    /^[A-HJ-NPR-Z0-9]{17}$/.test(draft.vinInput.trim().toUpperCase());
  const hasPlateOk = isValidPlateCr(draft.plate);
  if (vinFormatOk && !hasVin17 && !hasPlateOk) {
    errors.push({
      key: "vehicleId",
      message: "Indica un VIN válido (17 caracteres) o una placa de 6–8 caracteres.",
    });
  }

  if (parseYear(draft.yearInput) === null) {
    errors.push({
      key: "year",
      message: "Indica el año del vehículo (4 dígitos, 1990–año actual + 1).",
    });
  }

  if (draft.brand.trim().length === 0) {
    errors.push({
      key: "brand",
      message: "Selecciona la marca del vehículo.",
    });
  }

  if (draft.model.trim().length < 2) {
    errors.push({
      key: "model",
      message: "Indica el modelo del vehículo (mínimo 2 caracteres).",
    });
  }

  if (parseMileage(draft.mileageInput) === null) {
    errors.push({
      key: "mileage",
      message: "Indica el kilometraje o millaje (número mayor a 0).",
    });
  }

  if (draft.countryOfOrigin === "") {
    errors.push({
      key: "country",
      message: "Selecciona el país de origen.",
    });
  }

  if (
    draft.engineCategory === "combustion" &&
    draft.combustionFuel !== "gasolina" &&
    draft.combustionFuel !== "diesel" &&
    draft.combustionFuel !== "gas_lp"
  ) {
    errors.push({
      key: "combustionFuel",
      message: "Selecciona el tipo de combustible.",
    });
  }

  return { ok: errors.length === 0, errors };
}

export type CabeceraEditValidationInput = {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  captureSource: CaptureSource | "";
  sellerType: SellerTypeKey | "";
  province: string | null | undefined;
  photosOk: boolean;
  plate: string;
  vinInput: string;
  yearInput: string;
  brand: string;
  model: string;
  mileageInput: string;
  countryOfOrigin: string;
  engineCategory: VehicleWizardValidationInput["draft"]["engineCategory"];
  combustionFuel: VehicleWizardValidationInput["draft"]["combustionFuel"];
};

export function validateCabeceraEditForm(
  input: CabeceraEditValidationInput,
): { ok: boolean; errors: WizardValidationError[] } {
  const errors: WizardValidationError[] = [];
  const phoneDigits = normalizePhoneDigitsCr(input.clientPhone);

  if (input.clientName.trim().length < 3) {
    errors.push({
      key: "clientName",
      message: "Indica el nombre del cliente (mínimo 3 caracteres).",
    });
  }
  if (!isValidPhoneCr8Digits(phoneDigits)) {
    errors.push({
      key: "clientPhone",
      message: "Indica un teléfono válido de 8 dígitos (Costa Rica).",
    });
  }
  if (!isValidOptionalEmail(input.clientEmail)) {
    errors.push({
      key: "clientEmail",
      message: "Revisa el formato del correo electrónico.",
    });
  }
  if (input.sellerType === "") {
    errors.push({
      key: "sellerType",
      message: "Selecciona el origen de compra.",
    });
  }
  if (input.captureSource === "") {
    errors.push({
      key: "captureSource",
      message: "Indica cómo nos conoció el cliente.",
    });
  }
  if (!input.province) {
    errors.push({
      key: "province",
      message: "Selecciona la provincia.",
    });
  }

  const vehicle = validateVehicleWizardForm({
    draft: {
      plate: input.plate,
      vinInput: input.vinInput,
      yearInput: input.yearInput,
      brand: input.brand,
      model: input.model,
      mileageInput: input.mileageInput,
      countryOfOrigin: input.countryOfOrigin as VehicleWizardValidationInput["draft"]["countryOfOrigin"],
      engineCategory: input.engineCategory,
      combustionFuel: input.combustionFuel,
      vehiclePhotoFrontFile: null,
      vehiclePhotoSideLeftFile: null,
      vehiclePhotoSideRightFile: null,
      vehiclePhotoRearFile: null,
    },
    photosOk: input.photosOk,
  });
  errors.push(...vehicle.errors);

  return { ok: errors.length === 0, errors };
}
