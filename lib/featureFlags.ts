/**
 * Feature flags del cliente (Next.js). Valores por **entorno** (Vercel / `.env.local`).
 *
 * Fase 3: `NEXT_PUBLIC_USE_UNIFIED_DRAFT_FLOW` — activar con `"true"` o `"1"`.
 * Kill switch: bajar la variable y redeploy.
 */

const truthy = (v: string | undefined) => v === "true" || v === "1";

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
  return truthy(process.env.NEXT_PUBLIC_USE_UNIFIED_DRAFT_FLOW);
}
