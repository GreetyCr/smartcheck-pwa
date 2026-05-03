/**
 * UploadThing (cliente) valida con `file.type.includes("image")` sobre la clave de ruta.
 * Con `type` vacío (común en móvil/Safari/Brave) la subida falla antes de llegar al servidor.
 */
export function withImageMimeForUpload(file: File): File {
  if (file.type && /^image\//i.test(file.type)) return file;
  const stem = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([file], `${stem}.jpg`, { type: "image/jpeg" });
}
