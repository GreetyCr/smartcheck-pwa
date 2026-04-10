/**
 * Lógica de sincronización: cola offline → Convex cuando vuelve la red.
 */
export async function flushSyncQueue(): Promise<void> {
  // Conectar con Convex cuando esté integrado.
}

export function enqueueInspection(data: unknown): void {
  // Guardar en IndexedDB y marcar para sync.
}
