import { createHash } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

const revision =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  createHash("sha256")
    .update(String(Date.now()))
    .digest("hex")
    .slice(0, 12);

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    additionalPrecacheEntries: [
      { url: "/~offline", revision },
      { url: "/inspecciones/nueva/cliente", revision },
      { url: "/inspecciones/nueva/vehiculo", revision },
    ],
    useNativeEsbuild: true,
  });
