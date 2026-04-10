import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Next.js 16+: convención recomendada (antes `middleware.ts`).
 * Clerk acepta `middleware.(ts|js)` o `proxy.(ts|js)`.
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
export default clerkMiddleware();

/**
 * Importante: el patrón por defecto excluye `.png`, `.webmanifest`, etc.
 * Si esas URLs pasan por el App Router / layout con `auth()`, Clerk exige que
 * el middleware haya corrido → error "can't detect clerkMiddleware()".
 * Rutas explícitas para iconos PWA y manifest.
 */
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/icons/:path*",
    "/manifest.webmanifest",
  ],
};
