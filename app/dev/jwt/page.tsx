"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useMemo, useState } from "react";
import {
  audIncludesConvex,
  getConvexStyleToken,
} from "@/lib/clerk-convex-token";
import { decodeJwtPayloadUnsafe as decodeJwtPayload } from "@/lib/jwt-decode-insecure";

/**
 * Solo desarrollo: ver qué token usa Convex y comparar con el template JWT manual.
 */
export default function DevJwtPage() {
  const { isLoaded, isSignedIn, getToken, sessionClaims } = useAuth();
  const [primaryToken, setPrimaryToken] = useState<string | null>(null);
  const [templateToken, setTemplateToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPrimary = useCallback(async () => {
    setError(null);
    try {
      const t = await getConvexStyleToken(getToken, sessionClaims);
      setPrimaryToken(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [getToken, sessionClaims]);

  const loadTemplateOnly = useCallback(async () => {
    setError(null);
    try {
      const t = await getToken({ template: "convex" });
      setTemplateToken(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [getToken]);

  const primaryPayload = useMemo(
    () => (primaryToken ? decodeJwtPayload(primaryToken) : null),
    [primaryToken],
  );

  const templatePayload = useMemo(
    () => (templateToken ? decodeJwtPayload(templateToken) : null),
    [templateToken],
  );

  const sessionAud = sessionClaims?.aud;

  if (process.env.NODE_ENV === "production") {
    return <p className="p-6 text-muted-foreground">No disponible en producción.</p>;
  }

  return (
    <div className="max-w-3xl space-y-6 p-6 font-mono text-sm">
      <div>
        <h1 className="text-lg font-semibold">Debug JWT / Convex</h1>
        <p className="mt-2 text-muted-foreground leading-relaxed">
          Con la{" "}
          <strong>integración Convex activada en Clerk</strong>, el claim{" "}
          <code className="rounded bg-muted px-1">aud: &quot;convex&quot;</code> va en el{" "}
          <strong>token de sesión</strong>.{" "}
          <code className="rounded bg-muted px-1">ConvexClientProvider</code> entonces usa{" "}
          <code className="rounded bg-muted px-1">getToken()</code>{" "}
          <em>sin</em> template — el JWT template manual llamado{" "}
          <code className="rounded bg-muted px-1">convex</code> puede quedar{" "}
          <strong>sin usar</strong> (está bien dejarlo vacío o borrarlo si Clerk lo permite).
        </p>
        <p className="mt-2 text-muted-foreground leading-relaxed">
          <strong>No</strong> hace falta pulsar nada aquí para usar la app: el token se pide solo.
          Esto es solo para depurar cuando lo necesites.
        </p>
      </div>

      <p className="text-muted-foreground">
        Estado Clerk:{" "}
        {!isLoaded ? "cargando…" : isSignedIn ? "sesión iniciada" : "sin sesión"}
      </p>

      <div className="rounded border border-border bg-card p-3 text-xs">
        <span className="text-muted-foreground">sessionClaims.aud (Clerk) </span>
        <span className="font-medium">{JSON.stringify(sessionAud) ?? "—"}</span>
        {sessionAud != null && audIncludesConvex(sessionAud) ? (
          <span className="ml-2 text-green-600">✓ integración activa</span>
        ) : (
          <span className="ml-2 text-amber-600">
            (si está vacío, recarga tras iniciar sesión)
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-primary bg-primary/10 px-3 py-1.5"
          onClick={loadPrimary}
          disabled={!isSignedIn}
        >
          Token que usa Convex (recomendado)
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1.5"
          onClick={loadTemplateOnly}
          disabled={!isSignedIn}
        >
          Solo template JWT &quot;convex&quot; (opcional)
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Comparar con Convex</p>
        <p className="mt-1 leading-relaxed">
          En <strong>Convex Dashboard → Settings → Environment Variables</strong>,{" "}
          <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/80">
            CLERK_JWT_ISSUER_DOMAIN
          </code>{" "}
          debe ser <strong>exactamente</strong> el mismo string que{" "}
          <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/80">iss</code>{" "}
          del token de abajo (Frontend API URL de Clerk, sin <code>/</code> final).
        </p>
        <p className="mt-2 leading-relaxed">
          Opcional en <code className="rounded bg-amber-200/80 px-1">.env.local</code>:{" "}
          <code className="rounded bg-amber-200/80 px-1">
            NEXT_PUBLIC_CLERK_ISSUER_URL=https://…clerk.accounts.dev
          </code>{" "}
          (misma URL) para ver aquí si coincide.
        </p>
      </div>

      {primaryPayload && (
        <PayloadBlock
          title="Token que usa Convex (misma lógica que el provider)"
          payload={primaryPayload}
          expectedIssuerUrl={process.env.NEXT_PUBLIC_CLERK_ISSUER_URL}
        />
      )}

      {templatePayload && (
        <PayloadBlock
          title="Solo template JWT «convex» (puede fallar en aud si no lo usáis)"
          payload={templatePayload}
          expectedIssuerUrl={process.env.NEXT_PUBLIC_CLERK_ISSUER_URL}
        />
      )}

      {primaryToken && (
        <div className="space-y-2">
          <p className="text-muted-foreground">Token (principal) — jwt.io si querés ver todo</p>
          <textarea
            readOnly
            className="h-32 w-full rounded border bg-muted p-2 text-xs"
            value={primaryToken}
          />
        </div>
      )}
    </div>
  );
}

function normalizeIssuer(u: string): string {
  return u.trim().replace(/\/+$/, "");
}

function PayloadBlock({
  title,
  payload,
  expectedIssuerUrl,
}: {
  title: string;
  payload: Record<string, unknown>;
  /** Misma URL que `CLERK_JWT_ISSUER_DOMAIN` en Convex (opcional, solo dev). */
  expectedIssuerUrl?: string;
}) {
  const iss = payload.iss;
  const aud = payload.aud;
  const issOk = typeof iss === "string" && iss.includes("clerk.accounts");
  const audOk = audIncludesConvex(aud);

  const expected = expectedIssuerUrl?.trim();
  const issMatchesConvex =
    expected &&
    typeof iss === "string" &&
    normalizeIssuer(iss) === normalizeIssuer(expected);

  return (
    <div className="space-y-2 rounded border border-border bg-card p-4">
      <p className="font-semibold text-foreground">{title}</p>
      <div className="grid gap-1 text-xs">
        <div>
          <span className="text-muted-foreground">iss </span>
          <span className={issOk ? "text-green-600" : "text-amber-600"}>
            {String(iss)}
          </span>{" "}
          {issOk ? "✓" : ""}
          {expected ? (
            <span
              className={
                issMatchesConvex
                  ? " ml-2 text-green-600"
                  : " ml-2 font-medium text-red-600"
              }
            >
              {issMatchesConvex
                ? "Coincide con NEXT_PUBLIC_CLERK_ISSUER_URL"
                : "NO coincide con NEXT_PUBLIC_CLERK_ISSUER_URL → alinea Convex y Clerk"}
            </span>
          ) : null}
        </div>
        <div>
          <span className="text-muted-foreground">aud </span>
          <span className={audOk ? "text-green-600" : "text-red-600"}>
            {JSON.stringify(aud)}
          </span>{" "}
          {audOk ? "✓" : "✗ (activa integración Clerk↔Convex o template con aud: convex)"}
        </div>
      </div>
    </div>
  );
}
