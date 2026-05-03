const IMAGE_EXT =
  /\.(heic|heif|jpg|jpeg|jpe|png|gif|webp|bmp|tif|tiff|dng)$/i;

/**
 * iOS/Safari con `capture` suele devolver `File` con `type` vacío aunque sea imagen.
 * `application/octet-stream` aparece a veces con extensión conocida.
 */
export function isImageLikeFile(f: File): boolean {
  if (f.type.startsWith("image/")) return true;
  if (f.type === "application/octet-stream" && IMAGE_EXT.test(f.name)) {
    return true;
  }
  if (!f.type) {
    // Cámara móvil: MIME ausente; el input ya limita con accept="image/*"
    return true;
  }
  return false;
}
