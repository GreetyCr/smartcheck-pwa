import type { MetadataRoute } from "next";

/**
 * PWA manifest.
 * Ajustar name, short_name, icons y theme cuando se integre Serwist.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smartcheck PWA",
    short_name: "Smartcheck",
    description: "Inspección pre-compra de vehículos. Reportes Smartcheck.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f9fa",
    theme_color: "#1e3a5f",
    // Usar SVG hasta añadir PNG en `public/icons/` (evita 404 y errores de auth en rutas .png).
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
