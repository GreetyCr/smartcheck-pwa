import type { InspectionDraft } from "@/types/inspection-draft";
import type { CaptureSource, CountryOriginKey, MileageUnitKey, SellerTypeKey } from "@/types/inspection-draft";
import {
  createEmptyPendingInspectionRow,
  getDB,
  type InspectionData,
  type PendingPhotoRow,
} from "@/lib/offline/db";
import type { CabeceraPhotoSlot } from "@/lib/offline/photoSlots";
import { parseDigitsToAmount } from "@/lib/amount-input";
import {
  draftEngineToConvex,
  resolvePrimaryVehicleId,
} from "@/lib/vehicle-form";

const WIZARD_PHOTO_SLOTS: {
  fileKey: keyof Pick<
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
  slot: CabeceraPhotoSlot;
}[] = [
  { fileKey: "vehiclePhotoFrontFile", slot: "vehicleFront" },
  { fileKey: "vehiclePhotoSideLeftFile", slot: "vehicleSideLeft" },
  { fileKey: "vehiclePhotoSideRightFile", slot: "vehicleSideRight" },
  { fileKey: "vehiclePhotoRearFile", slot: "vehicleRear" },
  { fileKey: "photoDekraFile", slot: "dekra" },
  { fileKey: "photoPlateFile", slot: "plate" },
  { fileKey: "photoMarchamoFile", slot: "marchamo" },
  { fileKey: "photoVinStickerFile", slot: "vinSticker" },
];

function buildInspectionPayload(
  draft: InspectionDraft,
  yearNum: number,
  mileageNum: number,
): InspectionData {
  const source = draft.captureSource as CaptureSource;
  const sellerType = draft.sellerType as SellerTypeKey;
  const ids = resolvePrimaryVehicleId(draft.plate, draft.vinInput);
  return {
    clientName: draft.clientName.trim(),
    clientPhone: draft.clientPhone.trim(),
    clientEmail: draft.clientEmail.trim() || undefined,
    sellerType,
    sellerNote: draft.sellerNote.trim() || undefined,
    captureSource: source,
    inGam: draft.inGam === "si" || draft.inGam === "no" ? draft.inGam : undefined,
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
    mileageUnit: draft.mileageUnit as MileageUnitKey,
    countryOfOrigin: draft.countryOfOrigin as CountryOriginKey,
    engineType: draftEngineToConvex({
      engineCategory: draft.engineCategory,
      combustionFuel: draft.combustionFuel,
    }),
    platePhotoNote: draft.platePhotoNote.trim() || undefined,
    status: "draft",
  };
}

/**
 * Persiste wizard unificado en IDB (sin Convex). Fotos van a `pendingPhotos` con `slot`.
 */
export async function saveUnifiedWizardDraft(args: {
  clientId: string;
  draft: InspectionDraft;
  yearNum: number;
  mileageNum: number;
}): Promise<void> {
  const { clientId, draft, yearNum, mileageNum } = args;
  const db = await getDB();
  const now = Date.now();
  const row = createEmptyPendingInspectionRow(clientId);
  row.data = buildInspectionPayload(draft, yearNum, mileageNum);
  row.syncStatus = "pending";
  row.updatedAt = now;

  const pendingPhotos: PendingPhotoRow[] = [];
  for (const { fileKey, slot } of WIZARD_PHOTO_SLOTS) {
    const file = draft[fileKey];
    if (!file) continue;
    const id = `${clientId}-${slot}`;
    pendingPhotos.push({
      id,
      inspectionLocalId: clientId,
      sectionTable: "cabecera",
      itemKey: slot,
      slot,
      blob: file,
      createdAt: now,
      status: "pending",
    });
  }

  row.photos = pendingPhotos;

  const tx = db.transaction(["pendingInspections", "pendingPhotos"], "readwrite");
  await tx.objectStore("pendingInspections").put(row);
  for (const photo of pendingPhotos) {
    await tx.objectStore("pendingPhotos").put(photo);
  }
  await tx.done;
}
