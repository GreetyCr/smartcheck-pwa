# Offline / IndexedDB (`lib/offline`)

## Logs del cliente: prefijo `[offline-db]`

Mensajes greppables (Sentry / soporte). Catálogo:

| Fragmento / `reason` | Significado |
|------------------------|--------------|
| `migration_degraded` + `transaction_failed` | Falló la transacción de migración v2 de `clientId` en IDB. |
| `migration_degraded` + `idb_blocked_pending_upgrade` | Otra pestaña bloqueó el `upgradeneeded` de IndexedDB; cerrar otras pestañas o recargar. |
| `migration_row_failed` | Error al migrar una fila en IDB; a continuación va `localId` de la fila y el error (se continúa con el resto). |
| `idb_blocked` (warn) | Aviso previo al estado degradado por bloqueo de versión. |

Detalle operativo del borrador local (Fase 2): [`docs/PR_C_FASE2_OPERATIVO.md`](../docs/PR_C_FASE2_OPERATIVO.md).
