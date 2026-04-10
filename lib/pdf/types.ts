export type PdfExportPayload = {
  inspection: Record<string, unknown>;
  sections: Array<{
    table: string;
    doc: Record<string, unknown> | null;
    itemPhotoUrls: Record<string, string[]>;
    sectionPhotoUrls: string[];
  }>;
  vehiclePhotoUrl: string | null;
  circulationCardUrl: string | null;
};
