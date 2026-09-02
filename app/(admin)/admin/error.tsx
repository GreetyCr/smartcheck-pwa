"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Qué se ve cuando algo del panel revienta.
 *
 * **Por qué existe.** La app no tenía **ningún** boundary, así que cualquier
 * excepción del cliente mostraba la pantalla cruda de Next —«Application error:
 * a client-side exception has occurred»— sin decir qué hacer. Le pasó a Greety
 * el 2-set en `/admin/leads` y se arregló recargando, que es exactamente lo que
 * la pantalla no ofrecía.
 *
 * **La causa más común, y por eso el texto la nombra.** Cuando se publica una
 * versión con la pestaña abierta, el JavaScript viejo pide un archivo que ya no
 * existe y el navegador tira `ChunkLoadError`. No es un dato malo ni una cuenta
 * mal hecha: es la página vieja hablando con el servidor nuevo, y **recargar lo
 * resuelve siempre**. Decirlo evita que un error cosmético se lea como que el
 * panel perdió información.
 *
 * Va en `/admin` y no en `global-error` a propósito: acá el boundary conserva el
 * tema y el marco, y `reset()` reintenta **solo el contenido** en vez de recargar
 * el documento entero.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A la consola, no a un servicio: no hay telemetría en el proyecto y no se
    // va a agregar una por esto. El `digest` es lo que permite cruzarlo con los
    // logs de Vercel si alguna vez hace falta.
    console.error("[admin] error de render:", error);
  }, [error]);

  const esChunk =
    error.name === "ChunkLoadError" ||
    /chunk|dynamically imported module|Failed to fetch/i.test(error.message);

  return (
    <div
      className={cn(
        ADMIN_THEME_CLASS,
        "flex min-h-dvh items-center justify-center px-6",
      )}
    >
      <div className="w-full max-w-lg rounded-2xl border border-[var(--bi-ring)] bg-[var(--bi-surface)] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-[var(--bi-warn)]"
            aria-hidden
          />
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold text-[var(--bi-ink)]">
              Esta pantalla no se pudo dibujar
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
              {esChunk ? (
                <>
                  Suele pasar cuando <strong>se publicó una versión nueva</strong>{" "}
                  con esta pestaña abierta: la página vieja pide un archivo que ya
                  no existe. <strong>Ningún dato se perdió</strong> y recargar lo
                  resuelve.
                </>
              ) : (
                <>
                  Los datos están a salvo: el panel solo lee, nunca borra. Si
                  vuelve a pasar después de recargar, avisale a Greety con la hora
                  y en qué pantalla fue.
                </>
              )}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--bi-income)] px-4 text-[13px] font-medium text-[var(--bi-ink)] transition-colors hover:bg-[var(--bi-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
              >
                <RotateCcw className="size-4" aria-hidden />
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex min-h-11 items-center rounded-xl border border-[var(--bi-ring)] px-4 text-[13px] text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
              >
                Recargar la página
              </button>
            </div>

            {error.digest ? (
              <p className="bi-num mt-4 border-t border-[var(--bi-ring)] pt-3 text-[11px] text-[var(--bi-ink-3)]">
                Código para reportarlo: {error.digest}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
