import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "./core";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
    ...(process.env.NODE_ENV === "development"
      ? { logLevel: "Debug" as const }
      : {}),
  },
});
