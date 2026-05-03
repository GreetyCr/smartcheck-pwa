/**
 * Token Clerk para Convex: misma regla que la doc oficial, con soporte de `aud` array.
 * @see https://docs.convex.dev/auth/clerk
 */

export function audIncludesConvex(aud: unknown): boolean {
  if (aud === "convex") return true;
  if (Array.isArray(aud)) return aud.includes("convex");
  return false;
}

/** Firma habitual de `useAuth().getToken` en Clerk. */
export type ClerkGetTokenFn = (
  opts?: { skipCache?: boolean } | { template: string; skipCache?: boolean },
) => Promise<string | null>;

export async function getConvexStyleToken(
  getToken: ClerkGetTokenFn,
  sessionClaims: Record<string, unknown> | null | undefined,
  options?: { skipCache?: boolean },
): Promise<string | null> {
  const skipCache = options?.skipCache;
  if (audIncludesConvex(sessionClaims?.aud)) {
    return await getToken({ skipCache });
  }
  return await getToken({ template: "convex", skipCache });
}
