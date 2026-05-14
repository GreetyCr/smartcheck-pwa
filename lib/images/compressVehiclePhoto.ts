/** Lado mayor en px; encaja con objetivo ~200–400 KB por foto en inspección típica. */
export const VEHICLE_PHOTO_MAX_EDGE = 1600;

/**
 * Calidad JPEG post-canvas. 0.82 reduce banding en sombras vs 0.78 con poco coste de tamaño;
 * ajustar solo tras medición en dispositivos reales.
 */
export const VEHICLE_PHOTO_JPEG_QUALITY = 0.82;

/** MIME explícito en el `File` de salida (subidas y validaciones suelen filtrar por `type`). */
export const VEHICLE_PHOTO_OUTPUT_MIME = "image/jpeg" as const;

/** Mensaje para mostrar en UI si el dispositivo no puede decodificar la imagen (p. ej. HEIC sin soporte). */
export const VEHICLE_PHOTO_DECODE_USER_MESSAGE =
  "Esta imagen no se puede procesar en este dispositivo. Tomá la foto con la cámara desde la app.";

export class CompressVehiclePhotoError extends Error {
  readonly code = "DECODE_FAILED" as const;

  constructor(message = VEHICLE_PHOTO_DECODE_USER_MESSAGE) {
    super(message);
    this.name = "CompressVehiclePhotoError";
  }
}

export type CompressedVehiclePhoto = {
  /** JPEG listo para subir / guardar en borrador. */
  file: File;
  width: number;
  height: number;
  bytes: number;
};

/** Expuesto para tests unitarios sin DOM. */
export function computeScaledDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest <= 0) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function jpegBaseName(originalName: string): string {
  const base = originalName.split(/[/\\]/).pop() || "foto";
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${stem || "foto"}.jpg`;
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("compressVehiclePhoto: toBlob devolvió null"));
      },
      VEHICLE_PHOTO_OUTPUT_MIME,
      quality,
    );
  });
}

function closeBitmapSafe(bitmap: ImageBitmap): void {
  try {
    bitmap.close();
  } catch {
    /* algunos motores toleran doble close; Safari iOS: no fallar el flujo */
  }
}

/**
 * Reescala al lado mayor `maxEdge`, JPEG con calidad fija, sin EXIF en salida
 * (canvas descarta metadata). Intenta `createImageBitmap` primero (HEIC/JPEG/PNG según soporte del motor).
 *
 * `ImageBitmap` se cierra en `finally` tras cualquier éxito o fallo en canvas/toBlob (memoria GPU en Safari iOS).
 */
export async function compressVehiclePhoto(
  file: File,
  options?: { maxEdge?: number; quality?: number },
): Promise<CompressedVehiclePhoto> {
  if (typeof createImageBitmap !== "function") {
    throw new CompressVehiclePhotoError();
  }

  const maxEdge = options?.maxEdge ?? VEHICLE_PHOTO_MAX_EDGE;
  const quality = options?.quality ?? VEHICLE_PHOTO_JPEG_QUALITY;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new CompressVehiclePhotoError();
  }

  try {
    const { width: w, height: h } = computeScaledDimensions(
      bitmap.width,
      bitmap.height,
      maxEdge,
    );

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new CompressVehiclePhotoError();
    }
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await canvasToJpegBlob(canvas, quality);
    const outName = jpegBaseName(file.name);
    const out = new File([blob], outName, {
      type: VEHICLE_PHOTO_OUTPUT_MIME,
      lastModified: Date.now(),
    });

    if (out.type !== VEHICLE_PHOTO_OUTPUT_MIME) {
      throw new Error("compressVehiclePhoto: File.type no es image/jpeg");
    }

    return {
      file: out,
      width: w,
      height: h,
      bytes: out.size,
    };
  } finally {
    closeBitmapSafe(bitmap);
  }
}
