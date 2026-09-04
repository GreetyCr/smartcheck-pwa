/**
 * Feature flags del cliente (Next.js). Valores por **entorno** (Vercel / `.env.local`).
 *
 * Fase 3: `NEXT_PUBLIC_USE_UNIFIED_DRAFT_FLOW` — valores típicos `"true"` o `"1"`
 * (se aceptan variantes con espacios o mayúsculas; ver `isTruthyPublicEnv`).
 * Kill switch: bajar la variable y redeploy.
 */

function isTruthyPublicEnv(value: string | undefined): boolean {
  if (value === undefined) return false;
  const n = String(value).trim().toLowerCase();
  return n === "true" || n === "1";
}

const UNIFIED_DRAFT_FLOW = isTruthyPublicEnv(
  process.env.NEXT_PUBLIC_USE_UNIFIED_DRAFT_FLOW,
);

declare global {
  interface Window {
    /** Solo cliente; útil en DevTools / soporte (valor fijado al cargar el bundle). */
    __smartcheck?: { useUnifiedDraftFlow: boolean };
  }
}

/**
 * El valor queda colgado de `window` para QA y soporte: en DevTools se lee con
 * `__smartcheck` cuando hace falta.
 *
 * Antes esto además imprimía `[smartcheck] useUnifiedDraftFlow: …` en cada
 * carga. Se quitó: decía siempre lo mismo, a todo el mundo, en producción, y
 * una consola con ruido fijo es una consola que nadie mira el día que aparece
 * algo de verdad. El dato no se perdió — se pide cuando se necesita.
 *
 * **No borrar el `import "@/lib/featureFlags"` de `ConvexClientProvider`**: no
 * es un import muerto, es lo que hace que esto corra al cargar el bundle.
 */
if (typeof window !== "undefined") {
  window.__smartcheck = {
    ...(window.__smartcheck ?? {}),
    useUnifiedDraftFlow: UNIFIED_DRAFT_FLOW,
  };
}

/**
 * Flujo unificado local-first (rutas nuevas, wizard bajo el modelo IDB + cola).
 *
 * **Regla de rollback (no violar por intuición):** este flag solo controla la
 * **entrada** al flujo unificado (rutas / creación bajo el nuevo modelo). La
 * **cola de sync (`processSyncQueue` / lifecycle) sigue drenando siempre** que
 * haya trabajo pendiente en IDB, aunque el flag esté en `false`. Apagar el flag
 * no debe dejar borradores locales huérfanos sin sincronizar.
 */
export function useUnifiedDraftFlow(): boolean {
  return UNIFIED_DRAFT_FLOW;
}
