/**
 * UploadThing core config.
 * Configurar con createUploadthing() cuando se integre UploadThing.
 */
// import { createUploadthing } from "uploadthing/next";

export const ourFileRouter = {
  // imageUploader: f({ image: { maxFileSize: "4MB" } }).onUploadComplete(...)
};

export type OurFileRouter = typeof ourFileRouter;
