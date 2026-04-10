/** Fuente de captación (coincide con `captureSource` en Convex). */
export type CaptureSource =
  | "publicidad"
  | "tiktok"
  | "buscador"
  | "recompra"
  | "referido";

/** Valores de `countryOfOrigin` en Convex. */
export type CountryOriginKey =
  | "estados_unidos"
  | "corea"
  | "japon"
  | "alemania"
  | "mexico"
  | "otro";

/** UI paso 2 — se mapea a `engineType` de Convex. */
export type DraftEngineUi = "combustion" | "electrico";

/** Borrador del wizard de inspección (pasos 1–4). */
export interface InspectionDraft {
  clientName: string;
  clientPhone: string;
  location: string;
  locationCoords?: { lat: number; lng: number };
  /** Número de revisiones (solo borrador local; aún no en Convex). */
  inspectionCount: 1 | 2 | 3;
  isInGAM: boolean;
  /** Vacío hasta que el usuario elija (validación paso 1). */
  captureSource: CaptureSource | "";
  /** Si está en GAM → 0 al avanzar; si no, se definirá en una iteración posterior. */
  outOfGamFee?: number;

  // Paso 2 — Vehículo
  /** Archivo local hasta subir a Convex. */
  vehiclePhotoFile: File | null;
  plate: string;
  /** Vacío en UI hasta completar */
  yearInput: string;
  vinInput: string;
  brand: string;
  model: string;
  mileageInput: string;
  countryOfOrigin: CountryOriginKey | "";
  engineType: DraftEngineUi;
}

export function createEmptyInspectionDraft(): InspectionDraft {
  return {
    clientName: "",
    clientPhone: "",
    location: "",
    inspectionCount: 1,
    isInGAM: false,
    captureSource: "",
    vehiclePhotoFile: null,
    plate: "",
    yearInput: "",
    vinInput: "",
    brand: "",
    model: "",
    mileageInput: "",
    countryOfOrigin: "",
    engineType: "combustion",
  };
}
