export type VehicleAnglePhotoUrls = {
  front: string | null;
  sideLeft: string | null;
  sideRight: string | null;
  rear: string | null;
};

export type ExtraVehiclePhotoUrls = {
  dekra: string | null;
  plate: string | null;
  marchamo: string | null;
  vinSticker: string | null;
  vinSticker2: string | null;
  mileage: string | null;
};

export type PdfExportPayload = {
  inspection: Record<string, unknown>;
  sections: Array<{
    table: string;
    doc: Record<string, unknown> | null;
    itemPhotoUrls: Record<string, string[]>;
    sectionPhotoUrls: string[];
  }>;
  /** Primera foto disponible (frontal o legacy `vehiclePhoto`). */
  vehiclePhotoUrl: string | null;
  circulationCardUrl: string | null;
  vehicleAnglePhotoUrls: VehicleAnglePhotoUrls;
  extraVehiclePhotoUrls: ExtraVehiclePhotoUrls;
};
