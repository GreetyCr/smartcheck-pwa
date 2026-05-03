import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@clerk/nextjs/server";

const f = createUploadthing();

/**
 * Fotos por ítem de sección del checklist (URLs guardadas en `itemPhotos` del doc Convex).
 * Fotos del wizard de vehículo (ángulos, placa, etc.) usan Convex Storage (`generateUploadUrl`).
 */
export const ourFileRouter = {
  inspectionPhoto: f({
    /** Una petición = un archivo desde `usePhotoUpload`; 8MB margen tras compresión / móvil. */
    image: { maxFileSize: "8MB", maxFileCount: 10 },
  })
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) throw new UploadThingError("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async ({ file }) => {
      const url =
        "ufsUrl" in file && typeof file.ufsUrl === "string"
          ? file.ufsUrl
          : "url" in file && typeof (file as { url?: string }).url === "string"
            ? (file as { url: string }).url
            : "";
      return { url };
    }),

  vehicleDocument: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) throw new UploadThingError("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async ({ file }) => {
      const url =
        "ufsUrl" in file && typeof file.ufsUrl === "string"
          ? file.ufsUrl
          : "url" in file && typeof (file as { url?: string }).url === "string"
            ? (file as { url: string }).url
            : "";
      return { url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
