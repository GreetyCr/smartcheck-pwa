/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          if (request.destination !== "document") return false;
          if (request.mode !== "navigate") return false;
          const nextRsc = request.headers.get("Next-Router-Prefetch");
          if (nextRsc === "1") return false;
          if (request.headers.get("RSC") === "1") return false;
          try {
            const path = new URL(request.url).pathname;
            if (path.startsWith("/inspecciones/")) return false;
          } catch {
            /* ignore */
          }
          return true;
        },
      },
    ],
  },
});

serwist.addEventListeners();
