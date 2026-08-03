import { z } from "zod";

/** Id opaco de Convex `_storage` (string no vacío). */
const convexStorageId = z.string().min(1);

const sellerType = z.enum(["concesionaria", "particular"]);
const captureSource = z.enum([
  "mercadeo",
  "tiktok",
  "buscador",
  "recompra",
  "referido",
]);
const transmissionType = z.enum([
  "automatico_2wd",
  "automatico_4wd",
  "manual_2wd",
  "manual_4wd",
]);
const engineType = z.enum([
  "gasolina",
  "diesel",
  "gas_lp",
  "electrico",
  "hibrido",
]);
/** Valores actuales aceptados en `createOrUpdateFromDraft` (sin literales legados del schema DB). */
const countryOfOrigin = z.enum([
  "usa",
  "nacional",
  "panama",
  "korea",
  "otros",
]);
const identifierType = z.enum(["vin", "placa"]);
const mileageUnit = z.enum(["km", "millas"]);
const inspectionStatus = z.enum([
  "draft",
  "completed",
  "pending_sync",
  "synced",
  "report_delivered",
]);
const biCommission = z.enum(["si", "no"]);
const inGam = z.enum(["si", "no"]);
const province = z.enum([
  "san_jose",
  "alajuela",
  "cartago",
  "heredia",
  "guanacaste",
  "puntarenas",
  "limon",
]);
const biVehicleCondition = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

/**
 * Payload parcial de inspección para sync local-first (`createOrUpdateFromDraft`).
 * Debe mantenerse alineado con `patchFields` en `convex/inspections.ts`.
 */
export const inspectionDraftPatchSchema = z.strictObject({
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().optional(),
  location: z.string().optional(),
  sellerType: sellerType.optional(),
  sellerNote: z.string().optional(),
  inspectionFee: z.number().optional(),
  outOfGamFee: z.number().optional(),
  inGam: inGam.optional(),
  province: province.nullable().optional(),
  manychatId: z.string().optional(),
  totalAmountCharged: z.number().nonnegative().optional(),
  captureSource: captureSource.optional(),
  vehicleBrand: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.number().optional(),
  transmissionType: transmissionType.optional(),
  engineType: engineType.optional(),
  engineSpec: z.string().optional(),
  countryOfOrigin: countryOfOrigin.optional(),
  identifierType: identifierType.optional(),
  identifier: z.string().optional(),
  plateNumber: z.string().optional(),
  vin: z.string().optional(),
  mileage: z.number().optional(),
  mileageUnit: mileageUnit.optional(),
  inspectionStartAt: z.number().optional(),
  vehiclePhoto: convexStorageId.optional(),
  vehiclePhotoFront: convexStorageId.optional(),
  vehiclePhotoSideLeft: convexStorageId.optional(),
  vehiclePhotoSideRight: convexStorageId.optional(),
  vehiclePhotoRear: convexStorageId.optional(),
  circulationCard: convexStorageId.optional(),
  photoDekra: convexStorageId.optional(),
  photoPlate: convexStorageId.optional(),
  platePhotoNote: z.string().optional(),
  photoMarchamo: convexStorageId.optional(),
  photoVinSticker: convexStorageId.optional(),
  photoVinSticker2: convexStorageId.optional(),
  photoMileage: convexStorageId.optional(),
  status: inspectionStatus.optional(),
  findingsCount: z.number().optional(),
  lastSyncedAt: z.number().optional(),
  reportDeliveredAt: z.number().optional(),
  biCommission: biCommission.optional(),
  biVehicleCondition: biVehicleCondition.optional(),
});

export type InspectionDraftPatch = z.infer<typeof inspectionDraftPatchSchema>;

/** Keys del patch — usar en tests de paridad con Convex. */
export const INSPECTION_DRAFT_PATCH_FIELD_KEYS = Object.keys(
  inspectionDraftPatchSchema.shape,
).sort() as (keyof typeof inspectionDraftPatchSchema.shape)[];

export function parseInspectionDraftPatch(input: unknown): InspectionDraftPatch {
  return inspectionDraftPatchSchema.parse(input);
}

export function safeParseInspectionDraftPatch(input: unknown) {
  return inspectionDraftPatchSchema.safeParse(input);
}
