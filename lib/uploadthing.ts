/**
 * Configuración de UploadThing para el cliente.
 * Usar con generateReactHelpers cuando se integre UploadThing.
 */
// import { generateReactHelpers } from "@uploadthing/react";
// import type { OurFileRouter } from "@/app/api/uploadthing/core";

// export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();

export const useUploadThing = () => ({});
export const uploadFiles = async () => [] as { url: string }[];
