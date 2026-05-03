"use client";

import { useAuth } from "@clerk/nextjs";
import {
  ConvexReactClient,
  ConvexProviderWithAuth,
} from "convex/react";
import { useCallback, useMemo, useRef } from "react";
import { getConvexStyleToken } from "@/lib/clerk-convex-token";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
}

const convex = new ConvexReactClient(convexUrl);

/** Estable para deps: solo cambia cuando cambia el audience relevante para Convex. */
function convexAudDependencyKey(
  claims: Record<string, unknown> | null | undefined,
): string {
  const aud = claims?.aud;
  if (aud === "convex") return "convex";
  if (Array.isArray(aud)) return `arr:${[...aud].sort().join(",")}`;
  return aud === undefined || aud === null ? "" : String(aud);
}

/**
 * Reemplazo de `ConvexProviderWithClerk`: el oficial memoiza `fetchAccessToken` sin
 * `sessionClaims`, así que tras hidratar Clerk el token puede quedar mal (y el catch
 * vacío oculta errores). Aquí se refresca auth cuando cambia `aud` / sesión.
 */
function useConvexAuthFromClerk() {
  const { isLoaded, isSignedIn, getToken, sessionClaims, orgId, orgRole } =
    useAuth();

  const getTokenRef = useRef(getToken);
  const sessionClaimsRef = useRef(sessionClaims);
  getTokenRef.current = getToken;
  sessionClaimsRef.current = sessionClaims;

  const audDep = convexAudDependencyKey(sessionClaims);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        return await getConvexStyleToken(
          getTokenRef.current,
          sessionClaimsRef.current,
          { skipCache: forceRefreshToken },
        );
      } catch (e) {
        console.error("[Convex] Clerk getToken failed:", e);
        return null;
      }
    },
    // `getToken` omitted (unstable); refs hold latest. Re-run when audience/session shape changes.
    [audDep, orgId, orgRole, isLoaded],
  );

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
      fetchAccessToken,
    }),
    [isLoaded, isSignedIn, fetchAccessToken],
  );
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthFromClerk}>
      {children}
    </ConvexProviderWithAuth>
  );
}
