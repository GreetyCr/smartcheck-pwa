import {
  compressImage,
  type CompressionOptions,
} from "@/lib/images/compressImage";

/** Si el canvas no puede decodificar (p. ej. HEIC en algunos navegadores), sube el original. */
export async function compressImageOrFallback(
  file: File,
  options?: CompressionOptions,
): Promise<File> {
  try {
    return await compressImage(file, options);
  } catch {
    if (!file.type) {
      return new File([file], file.name || "photo.jpg", {
        type: "image/jpeg",
      });
    }
    return file;
  }
}
