"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import {
  audIncludesConvex,
  convexSessionAudDependencyKey,
  getConvexStyleToken,
} from "@/lib/clerk-convex-token";
import { decodeJwtPayloadUnsafe } from "@/lib/jwt-decode-insecure";

function normalizeIssuer(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Solo con `?sessiondebug=1`: JWT ↔ Convex y claims `iss`/`aud` del token real. */
export function SessionDebugPanel() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).has("sessiondebug"));
  }, []);

  const { user } = useUser();
  const { getToken, sessionClaims, isLoaded: clerkAuthLoaded } = useAuth();
  const dbg = useQuery(api.users.sessionSelf, enabled ? {} : "skip");

  const audKey = convexSessionAudDependencyKey(sessionClaims);
  const [probe, setProbe] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!enabled || !clerkAuthLoaded) {
      setProbe(null);
      return;
    }
    let cancelled = false;
    setProbe({ convexTokenProbe: "loading" });

    void (async () => {
      try {
        const token = await getConvexStyleToken(getToken, sessionClaims);
        if (cancelled) return;

        if (!token) {
          setProbe({
            convexTokenProbe: {
              error:
                "getToken devolvió null (template JWT «convex» o sesión incompleta).",
            },
          });
          return;
        }

        const payload = decodeJwtPayloadUnsafe(token);
        if (!payload) {
          setProbe({
            convexTokenProbe: { error: "No se pudo decodificar el JWT (payload)." },
          });
          return;
        }

        const issRaw = payload.iss;
        const iss =
          typeof issRaw === "string" ? normalizeIssuer(issRaw) : null;
        const aud = payload.aud;
        const envIssuer =
          typeof process.env.NEXT_PUBLIC_CLERK_ISSUER_URL === "string"
            ? normalizeIssuer(process.env.NEXT_PUBLIC_CLERK_ISSUER_URL)
            : null;

        setProbe({
          convexTokenProbe: {
            issFromJwt: iss,
            audFromJwt: aud,
            audIncludesConvex: audIncludesConvex(aud),
            subFromJwt: payload.sub,
            clerkSessionClaimsAud: sessionClaims?.aud ?? null,
            NEXT_PUBLIC_CLERK_ISSUER_URL: envIssuer ?? "(no definido en build)",
            issMatches_NEXT_PUBLIC_CLERK_ISSUER_URL:
              iss && envIssuer ? iss === envIssuer : null,
            convexDashboardHint: {
              CLERK_JWT_ISSUER_DOMAIN_must_equal:
                iss ??
                "(sin iss en token — revisa Clerk)",
              note: 'Si Convex muestra "No auth provider found matching the given token", copia issFromJwt exactamente en Convex → Settings → Environment Variables → CLERK_JWT_ISSUER_DOMAIN (sin / final). El dominio clerk.smartcheckpwa.com del template puede diferir del iss real del token.',
            },
          },
        });
      } catch (e) {
        if (!cancelled) {
          setProbe({
            convexTokenProbe: {
              error: e instanceof Error ? e.message : String(e),
            },
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, clerkAuthLoaded, getToken, sessionClaims, audKey]);

  if (!enabled) return null;

  const convexUrl =
    typeof process.env.NEXT_PUBLIC_CONVEX_URL === "string"
      ? process.env.NEXT_PUBLIC_CONVEX_URL
      : "(no definido en build)";

  const payload = {
    NEXT_PUBLIC_CONVEX_URL: convexUrl,
    clerkReactUserId: user?.id ?? null,
    sessionSelf: dbg,
    ...probe,
  };

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 p-3 text-left font-mono text-[10px] leading-relaxed">
      <p className="mb-2 font-sans text-xs font-semibold text-foreground">
        Diagnóstico (?sessiondebug=1)
      </p>
      <pre className="whitespace-pre-wrap break-all">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}
