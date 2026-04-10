"use client";

/**
 * Provider de Clerk (auth). Envolver la app cuando se integre Clerk.
 */
export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
