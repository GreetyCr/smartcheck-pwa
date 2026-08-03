/** Fuente de captación (coincide con `captureSource` en Convex). */
import { toDatetimeLocalValue } from "@/lib/datetime-local";

export type CaptureSource =
  | "mercadeo"
  | "tiktok"
  | "buscador"
  | "recompra"
  | "referido";

/** Valores de `countryOfOrigin` en Convex. */
export type CountryOriginKey =
  | "usa"
  | "nacional"
  | "panama"
  | "korea"
  | "otros";

export type SellerTypeKey = "concesionaria" | "particular";

export type CostaRicaProvinceKey =
  | "san_jose"
  | "alajuela"
  | "cartago"
  | "heredia"
  | "guanacaste"
  | "puntarenas"
  | "limon";

export type MileageUnitKey = "km" | "millas";

/** Categoría principal en el wizard de vehículo. */
export type DraftEngineCategory = "combustion" | "hibrido" | "electrico";

/** Solo si `engineCategory === "combustion"`. */
export type DraftCombustionFuel = "gasolina" | "diesel" | "gas_lp";

/** Borrador del wizard de inspección (pasos 1–4). */
export interface InspectionDraft {
  clientName: string;
  clientPhone: string;
  /** Opcional en Convex. */
  clientEmail: string;
  /** Número de revisiones (solo borrador local; aún no en Convex). */
  inspectionCount: 1 | 2 | 3;
  /** Vacío hasta elegir en paso cliente. */
  inGam: "si" | "no" | "";
  /** Provincia donde se realiza/cobra la revisión (requerida en nuevas inspecciones). */
  province: CostaRicaProvinceKey | "";
  /** Monto adicional (solo si `inGam === "no"`). Dígitos en UI vía `outOfGamFeeInput`. */
  outOfGamFeeInput: string;
  /** Vacío hasta que el usuario elija (validación paso 1). */
  captureSource: CaptureSource | "";
  /** Paso 1 — contexto comercial / BI. */
  sellerType: SellerTypeKey | "";
  sellerNote: string;

  // Paso 2 — Vehículo
  vehiclePhotoFrontFile: File | null;
  vehiclePhotoSideLeftFile: File | null;
  vehiclePhotoSideRightFile: File | null;
  vehiclePhotoRearFile: File | null;
  photoDekraFile: File | null;
  photoPlateFile: File | null;
  photoMarchamoFile: File | null;
  photoVinStickerFile: File | null;
  photoVinSticker2File: File | null;
  photoMileageFile: File | null;
  /** Texto opcional junto a la foto de placa. */
  platePhotoNote: string;
  /** Valor de `<input type="datetime-local">` (hora de inicio del informe). */
  inspectionStartAtLocal: string;
  plate: string;
  /** Vacío en UI hasta completar */
  yearInput: string;
  vinInput: string;
  brand: string;
  model: string;
  mileageInput: string;
  mileageUnit: MileageUnitKey;
  countryOfOrigin: CountryOriginKey | "";
  /** Combustión / Híbrido / Eléctrico. */
  engineCategory: DraftEngineCategory;
  /** Obligatorio si `engineCategory === "combustion"` (Gasolina, Diésel o Gas LP). */
  combustionFuel: DraftCombustionFuel | "";
}

export function createEmptyInspectionDraft(): InspectionDraft {
  return {
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    inspectionCount: 1,
    inGam: "",
    province: "",
    outOfGamFeeInput: "",
    captureSource: "",
    sellerType: "",
    sellerNote: "",
    vehiclePhotoFrontFile: null,
    vehiclePhotoSideLeftFile: null,
    vehiclePhotoSideRightFile: null,
    vehiclePhotoRearFile: null,
    photoDekraFile: null,
    photoPlateFile: null,
    photoMarchamoFile: null,
    photoVinStickerFile: null,
    photoVinSticker2File: null,
    photoMileageFile: null,
    platePhotoNote: "",
    inspectionStartAtLocal: toDatetimeLocalValue(Date.now()),
    plate: "",
    yearInput: "",
    vinInput: "",
    brand: "",
    model: "",
    mileageInput: "",
    mileageUnit: "km",
    countryOfOrigin: "",
    engineCategory: "combustion",
    combustionFuel: "",
  };
}
