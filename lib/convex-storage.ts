import type { Id } from "@/convex/_generated/dataModel";

/** Sube un `File` a Convex Storage usando la URL devuelta por `generateUploadUrl`. */
export async function uploadFileToConvexStorage(
  postUrl: string,
  file: File,
): Promise<Id<"_storage">> {
  const res = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Error al subir (${res.status})`);
  }

  const json = (await res.json()) as { storageId?: string };
  if (!json.storageId) throw new Error("Respuesta sin storageId");

  return json.storageId as Id<"_storage">;
}
