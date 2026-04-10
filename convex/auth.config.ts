import type { AuthConfig } from "convex/server";

/**
 * Valida JWT de Clerk en Convex. Configura `CLERK_JWT_ISSUER_DOMAIN` en el
 * Dashboard de Convex (Frontend API URL de Clerk, p. ej. https://xxx.clerk.accounts.dev).
 * @see https://docs.convex.dev/auth/clerk
 */
function normalizeIssuerDomain(raw: string | undefined): string {
  if (!raw?.trim()) {
    throw new Error(
      "Set CLERK_JWT_ISSUER_DOMAIN or CLERK_FRONTEND_API_URL (Clerk Frontend API URL)",
    );
  }
  // issuer en JWT suele ir sin barra final; evita mismatch por "/" extra
  return raw.trim().replace(/\/+$/, "");
}

/** Clerk a veces documenta `CLERK_FRONTEND_API_URL`; Convex suele usar `CLERK_JWT_ISSUER_DOMAIN` — mismo valor. */
function clerkIssuerFromEnv(): string {
  return normalizeIssuerDomain(
    process.env.CLERK_JWT_ISSUER_DOMAIN ?? process.env.CLERK_FRONTEND_API_URL,
  );
}

export default {
  providers: [
    {
      domain: clerkIssuerFromEnv(),
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
