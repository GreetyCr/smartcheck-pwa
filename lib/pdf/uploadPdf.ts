"use client";

import type { Id } from "@/convex/_generated/dataModel";

/** Sube un PDF a Convex Storage usando la URL POST de `generatePdfUploadUrl` / `generateUploadUrl`. */
export async function uploadPdfBlobToConvex(
  postUrl: string,
  blob: Blob,
): Promise<Id<"_storage">> {
  const res = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: blob,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Error al subir PDF (${res.status})`);
  }

  const json = (await res.json()) as { storageId?: string };
  if (!json.storageId) throw new Error("Respuesta sin storageId");

  return json.storageId as Id<"_storage">;
}
