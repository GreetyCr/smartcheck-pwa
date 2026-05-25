import type { Id } from "@/convex/_generated/dataModel";

/** Slots de cabecera alineados a `photoManifest` en Convex (Fase 5). */
export const CABECERA_PHOTO_SLOTS = [
  "vehicleFront",
  "vehicleSideLeft",
  "vehicleSideRight",
  "vehicleRear",
  "dekra",
  "plate",
  "marchamo",
  "vinSticker",
] as const;

export type CabeceraPhotoSlot = (typeof CABECERA_PHOTO_SLOTS)[number];

export function isCabeceraPhotoSlot(value: string): value is CabeceraPhotoSlot {
  return (CABECERA_PHOTO_SLOTS as readonly string[]).includes(value);
}

/** Campo `patch` / documento Convex para cada slot. */
export const CABECERA_SLOT_TO_PATCH_FIELD: Record<
  CabeceraPhotoSlot,
  | "vehiclePhotoFront"
  | "vehiclePhotoSideLeft"
  | "vehiclePhotoSideRight"
  | "vehiclePhotoRear"
  | "photoDekra"
  | "photoPlate"
  | "photoMarchamo"
  | "photoVinSticker"
> = {
  vehicleFront: "vehiclePhotoFront",
  vehicleSideLeft: "vehiclePhotoSideLeft",
  vehicleSideRight: "vehiclePhotoSideRight",
  vehicleRear: "vehiclePhotoRear",
  dekra: "photoDekra",
  plate: "photoPlate",
  marchamo: "photoMarchamo",
  vinSticker: "photoVinSticker",
};

export type PhotoManifestEntry = {
  clientPhotoId: string;
  storageId: Id<"_storage">;
  slot: CabeceraPhotoSlot;
};
