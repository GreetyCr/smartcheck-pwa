# Operación — local-first y retención

## Constantes de retención (editables)

Definidas en `lib/offline/retention.ts` (Fase 7 — implementado) y reexportadas aquí como referencia:

| Constante | Valor propuesto | Efecto |
|-----------|-----------------|--------|
| `WIZARD_PURGE_BLOBS_AFTER_SYNC_DAYS` | **7** | Tras `syncStatus === "synced"`, si `syncedAt` es anterior a `now - 7d`, eliminar `row.wizard` y blobs pesados de la fila IDB. |
| `LOCAL_ROW_METADATA_RETENTION_DAYS` | **30** | Conservar la fila con metadatos ligeros hasta `now - 30d` para diagnóstico; luego borrar fila o archivar según política final. |

## Arranque

Al boot de la app (p. ej. en `SyncProvider` o layout raíz), invocar `runRetentionSweep()` de forma no bloqueante.

## Estado de sync (fuente de verdad)

- Mientras `syncStatus !== "synced"` en la fila IDB: **la fila IDB es autoritativa** para UI de progreso y errores de cola.
- A partir de `synced`: **el estado en Convex** manda para el informe ya persistido; la fila local se reduce a metadatos / se purga según retención.

`hooks/useSyncQueue.ts` debe documentar esta regla en comentario de cabecera; la UI de Fase 6 elige una u otra fuente, sin mezclar ambas en el mismo widget.

## Webhook n8n

Dentro de `createOrUpdateFromDraft`, cualquier evento tipo `inspection_created` debe programarse con `ctx.scheduler.runAfter(0, internal.n8nWebhook.deliver, …)` para no bloquear ni alterar la atomicidad perceptible de la mutación.

## Documentación de flujo (`FLUJO_CREACION_INFORME.html`)

Al actualizar en Fase 7: mantener el informe **orientado a negocio** (sin detalle interno de cabecera). Sí reflejar: modelo local-first, `clientId` estable en URL, cola unificada y sync en segundo plano.

---

## PR-A (Fase 1 — compresión wizard): verificación manual iOS Safari

Antes de mergear, en **dispositivo iOS real** (no solo simulador), con `pnpm dev` o build de staging:

1. **Cuatro fotos obligatorias** del paso vehículo: anotar en la **descripción del PR** el **peso final en KB** de cada una (rangos observados sirven).
2. **Cambiar de pestaña → volver** al wizard: documentar si el estado se **conserva** o se **pierde**. En Fase 1 el borrador vive en **RAM**; perderlo **no es regresión**, es baseline hasta persistencia local (Fase 2+).
3. **HEIC desde galería** (si el dispositivo lo ofrece): confirmar que **decodea y comprime**, o que, si falla, aparece el texto de `VEHICLE_PHOTO_DECODE_USER_MESSAGE` bajo el bloque de fotos **sin** stack trace ni error crudo.
4. Si no hay merge aún, el mismo checklist aplica en **producción** durante una ventana de prueba (p. ej. downtime pactado).

Constantes de calidad JPEG: `VEHICLE_PHOTO_JPEG_QUALITY` en `lib/images/compressVehiclePhoto.ts` (actual **0.82**; ajustar solo tras revisión visual en sombras).

---

## Follow-ups técnicos (post PR-A, no bloqueantes)

- **`tsconfig.test.json`**: extender `tsconfig.json` con `include` de `**/*.test.ts` y script `test:typecheck` en CI para volver a type-check de tests cuando `vitest` esté en `node_modules`.
- **`vitest.config`**: cuando el equipo use siempre `vitest` instalado en local, se puede volver a `import { defineConfig } from "vitest/config"` para autocompletado del shape de config.
