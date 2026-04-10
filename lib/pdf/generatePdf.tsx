"use client";

import { pdf } from "@react-pdf/renderer";
import { InspectionReportDocument } from "@/lib/pdf/InspectionReportDocument";
import type { PdfExportPayload } from "@/lib/pdf/types";

export async function generateInspectionPdfBlob(
  data: PdfExportPayload,
): Promise<Blob> {
  const instance = pdf(<InspectionReportDocument data={data} />);
  return await instance.toBlob();
}
