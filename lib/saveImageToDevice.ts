"use client";

/** Nombre de archivo seguro para descarga. */
function fileSlug(text: string): string {
  const t = text
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
  return (t.length > 0 ? t : "foto").slice(0, 72);
}

/**
 * Descarga una imagen (URL https o blob:) al dispositivo con nombre sugerido.
 * En iOS suele requerir gesto del usuario (click en botón).
 */
export async function saveImageToDevice(
  imageUrl: string,
  suggestedBaseName: string,
  indexOneBased: number,
): Promise<void> {
  const slug = fileSlug(suggestedBaseName);
  const res = await fetch(imageUrl, {
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const type = blob.type || "image/jpeg";
  const ext = type.includes("png")
    ? "png"
    : type.includes("webp")
      ? "webp"
      : "jpg";
  const name = `Smartcheck_${slug}_${indexOneBased}.${ext}`;
  const href = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    globalThis.setTimeout(() => URL.revokeObjectURL(href), 4000);
  }
}
