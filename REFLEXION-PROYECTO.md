# Reflexión — Smartcheck PWA

Notas de contexto de desarrollo (módulos iniciales, PWA offline, integración con el stack real del repo).

## ¿Qué me pareció interesante del proyecto?

- **Dominio claro y con impacto real:** inspecciones en campo sin red, alineado con un problema concreto (herramientas que no funcionan offline). Eso guía bien las decisiones de arquitectura: IndexedDB, cola de fotos, sync explícita y requisitos medibles (tiempo de sync, almacenamiento).
- **Stack coherente para el caso de uso:** Next.js App Router + Convex para datos en vivo, Clerk para identidad, UploadThing para mídia, y Serwist para llevar el shell y la experiencia PWA al navegador.
- **Serwist con Turbopack en Next 16:** la ruta de integración no es la misma que con Webpack; combinar `withSerwist`, el route handler bajo `app/serwist/`, y el `SerwistProvider` conecta bien con el flujo de build que ya usa el proyecto.
- **Doble capa de “verdad” online/offline:** el hook que enruta entre Convex e IndexedDB, más un `SyncContext` que orquesta la cola, refleja de forma entendible el flujo del técnico (trabajar aunque falle la red, sincronizar después).

## ¿Qué es lo que más se dificultó?

- **Alineación de tipos y APIs reales:** el material de referencia a veces asumía `createDraft(data)` o nombres de módulos distintos; en el repo, `createDraft` no recibe cuerpo y `patch` usa `{ id, patch }`. Ajustar `sync` y `useOfflineInspection` a la API de Convex real fue clave.
- **TypeScript y el DOM en el entorno de build de Next:** aparecieron errores como `EventTarget` sin `value`/`files`, `navigator`/`window` no resueltos, o `Image`/`document` no encontrados. No siempre es por un `tsconfig` mal puesto: a veces mezcla de comprobaciones estrictas y tipos de React. Se resolvió con utilidades de formulario (`formControlValue`, etc.) y casts acotados sin cambiar el comportamiento en runtime.
- **PWA + auth + datos:** el service worker no sustituye a Convex; offline implica reglas claras (qué se guarda local, qué requiere JWT, y qué pasa al volver la red). Eso añade complejidad a la capa de sync y a las pruebas manuales (DevTools, modo offline, reintentos).

## Si lo volviera a hacer, ¿qué haría diferente?

- **Fijar antes un contrato de tipos compartido** entre “borrador local” y “documento Convex” (IDs locales vs `Id<"inspections">`, forma del `patch`, secciones), y documentarlo en un solo sitio, para que sync e inspecciones no diverjan.
- **Unificar utilidades de DOM** desde el inicio en un módulo pequeño (inputs, `confirm`/`alert`, `scrollY`, `localStorage`) y usarlo en formularios, para evitar ruido de tipos repartido en muchos archivos.
- **Pruebas automatizadas mínimas** en la lógica pura de `lib/offline/sync.ts` (mocks de mutaciones) y un smoke test de build con variables de entorno de CI, para detectar regresiones de sync sin depender solo de pruebas manuales en el dispositivo.
- **Criterio explícito post-sync:** decidir de entrada si los registros en IndexedDB se borran, se marcan `synced` o se purgan por antigüedad, para no crecer sin límite y cumplir requisitos de almacenamiento a largo plazo.

---

*Documento generado para reflexión de equipo; no es documentación de producto ni contrato técnico.*
