import {
  compressImageOrFallback,
  isImageLikeFile,
  withImageMimeForUpload,
} from "@/lib/images";

/** Re-lee el blob (Safari/IDB a veces devuelve referencias inválidas al sync). */
async function rehydrateBlob(blob: Blob): Promise<Blob> {
  if (blob.size === 0) {
    throw new Error("La foto local está vacía; capturala de nuevo.");
  }
  try {
    const buf = await blob.arrayBuffer();
    if (buf.byteLength === 0) {
      throw new Error("La foto local está vacía; capturala de nuevo.");
    }
    return new Blob([buf], { type: blob.type || "image/jpeg" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo leer la foto guardada: ${msg}`);
  }
}

/**
 * Normaliza blobs de IDB para subida a Convex Storage (móvil / PWA / HEIC).
 */
export async function preparePhotoBlobForUpload(
  blob: Blob,
  id: string,
): Promise<File> {
  const fresh = await rehydrateBlob(blob);
  const ext = fresh.type === "image/png" ? "png" : "jpg";
  let file = new File([fresh], `${id}.${ext}`, {
    type: fresh.type || "image/jpeg",
  });
  if (isImageLikeFile(file)) {
    file = withImageMimeForUpload(
      await compressImageOrFallback(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
      }),
    );
  }
  return file;
}
