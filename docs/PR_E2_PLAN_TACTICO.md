# PR-E2 — Plan táctico (pre-implementación)

Referencia: [MIGRACION_LOCAL_FIRST_CHECKLIST.md](./MIGRACION_LOCAL_FIRST_CHECKLIST.md) § Fase 3 — PR-E2.  
Objetivo de este documento: inventario y mapa de reemplazos para que PR-E2 sea ejecución mecánica, no improvisación archivo por archivo.

**Condición:** merge de PR-E1 (`resolveInspectionRef` + `useUnifiedInspection`).

---

## 1. Inventario — `useQuery(api.inspections.get)`

| Ubicación | Rol |
|-----------|-----|
| `components/inspection/InspectionSectionsScreen.tsx` | `inspection` para UI detalle, mutaciones, links |
| `components/inspection/SectionForm.tsx` | `inspection` + `useOfflineInspection` / secciones |
| `components/inspection/InspectionBiClosingFields.tsx` | `doc` + mutaciones BI |
| `components/inspection/InspectionPdfExport.tsx` | `get` (condicional `skip`) + PDF |
| `hooks/useOfflineInspection.ts` | `convexInspection` cuando online y sin fila local-only |

**Relacionado (mismo boundary de `inspectionId` Convex, no es `get` pero sí `id: Id<"inspections">`):**

| Ubicación | Query |
|-----------|--------|
| `components/inspection/InspectionCabeceraScreen.tsx` | `useQuery(api.inspections.getCabeceraEdit, { id: inspectionId })` |

**Fuera del alcance típico de PR-E2 (lista / historial / admin, no ruta `[id]`):**

- `app/(dashboard)/page.tsx` — `listByClerkUser`, `search`, `getVehicleHistory`
- `app/(dashboard)/historial/page.tsx` — mismo patrón lista
- `hooks/useSyncQueue.ts` — `countPendingSync`, `listPendingSyncIds`
- `app/(admin)/admin/inspecciones/page.tsx` — admin

Revisar en PR-E2 solo si aparece un link directo a detalle con `_id` legacy; el checklist centra PR-E2 en `app/(dashboard)/inspecciones/...` y componentes citados.

---

## 2. Inventario — `params.id` y `Id<"inspections">`

| Archivo | Uso actual |
|---------|------------|
| `app/(dashboard)/inspecciones/[id]/page.tsx` | `id as Id<"inspections">` → `InspectionSectionsScreen` |
| `app/(dashboard)/inspecciones/[id]/cabecera/page.tsx` | igual → `InspectionCabeceraScreen` |
| `app/(dashboard)/inspecciones/[id]/seccion/[seccionId]/page.tsx` | igual → `SectionForm` (u envoltorio) |
| `app/(dashboard)/inspecciones/[id]/pdf/page.tsx` | `params.id as string` → `router.replace(\`/inspecciones/${id}#informe-pdf\`)` (sin `get`) |

**Layout wizard (checklist PR-E2):**

| Archivo | Nota |
|---------|------|
| `app/(dashboard)/inspecciones/nueva/layout.tsx` | Solo `InspectionWizardProvider`; el cambio de URL/`clientId` suele vivir en pasos (`vehiculo`, `VehicleForm`, etc.). |

---

## 3. Inventario — props `inspectionId: Id<"inspections">` (o equivalente)

| Componente / hook | Prop / arg |
|-------------------|------------|
| `InspectionSectionsScreen` | `inspectionId` |
| `InspectionCabeceraScreen` | `inspectionId` |
| `SectionForm` | `inspectionId` |
| `SectionsList` | `pathSegment` (links `/inspecciones/{segment}/seccion/…`) |
| `InspectionPdfStatus` | `inspectionId` |
| `InspectionPdfExport` | `inspectionId` |
| `InspectionBiClosingFields` | `inspectionId` |
| `hooks/usePhotoUpload.ts` | `inspectionId` en opciones |
| `hooks/useOfflineInspection.ts` | `inspectionId?: string` (hoy mezcla local key + Convex id) |

`VehicleForm.tsx`: tras `createDraft`, `router.push(\`/inspecciones/${inspectionId}\`)` — **punto de entrada URL canónica** (`clientId` UUID estable según checklist).

---

## 4. Mapa «qué reemplaza qué» (transformación esperada)

Regla cerrada (checklist): URL **`/inspecciones/[clientId]`** con UUID v4; redirect **`router.replace`** si `resolve` → `kind === "convex"` y hay `clientId` canónico distinto del segmento legacy.

| Call site / capa | Cambio esperado (bajo `useUnifiedDraftFlow()`) |
|------------------|-----------------------------------------------|
| Páginas `[id]/*` | Dejar de castear `id` a `Id<"inspections">` como premisa única. Client wrapper (nuevo o mínimo) que llame `useUnifiedInspection(id)` (o resolver + deps solo si el patrón del equipo lo exige en server component — hoy las páginas son async server + pasan a client; probablemente **client boundary** que recibe `ref: string` y hace resolve + redirect + render hijos). |
| `kind === "not_found"` | Pantalla fija + CTA a `/inspecciones/nueva` (checklist § refinamiento 5). |
| `kind === "convex"` | `convexId` para `useQuery(get)`, `getCabeceraEdit`, mutaciones que exigen `Id<"inspections">`; `clientId` para URLs y `router.replace` canónico. |
| `kind === "local_only"` | Datos desde IDB + hints de solo lectura / cola hasta `convexId`; **no** `upsertSection` hasta existir padre en Convex (checklist § `SectionForm`). |
| `InspectionSectionsScreen` / `SectionForm` | Reciben ya sea `ref` resuelto + `convexId` opcional, o solo `convexId` tras capa resolve; **flag** decide si se usa flujo unificado o props actuales sin cambio. |
| `InspectionCabeceraScreen` | Mismo boundary: `getCabeceraEdit` solo con `convexId` real; hint + CTA sync = `processSyncQueue` compartido (checklist). |
| `useOfflineInspection` | Convive bajo flag; entradas pueden ser `clientId` UUID o legacy hasta limpieza. |
| `usePhotoUpload` | Sigue necesitando `Id<"inspections">` cuando exista `convexId`; si solo local, cola / sin upload Convex según Fase 5. |
| `app/.../[id]/pdf/page.tsx` | Tras URLs canónicas, el `replace` debe usar el **mismo** segmento de ruta que el detalle (idealmente `clientId` ya normalizado en URL). |

**Flag:** `useUnifiedDraftFlow()` desde `lib/featureFlags.ts` (`NEXT_PUBLIC_USE_UNIFIED_DRAFT_FLOW`). Rama nueva solo con flag ON; OFF = comportamiento actual (smoke checklist PR-E2).

---

## 5. Copies de UI (checklist + huecos producto)

Origen checklist § decisión 2 y § refinamiento 5.

| ID | Texto acordado / propuesto | Uso |
|----|-----------------------------|-----|
| `CABECERA_HINT_READONLY` | «Se podrá editar cuando el informe esté sincronizado» | Hint cabecera pre-sync (checklist). |
| `CABECERA_CTA_SYNC` | «Sincronizar ahora» | CTA opcional; debe llamar al mismo `processSyncQueue` que el lifecycle automático. |
| `NOT_FOUND_TITLE` | «Inspección no encontrada» | `kind === "not_found"` (refinamiento 5). |
| `NOT_FOUND_CTA` | (derivar de copy existente de navegación a nueva inspección; si no hay componente reutilizable, alinear tono con resto del dashboard) | CTA a `/inspecciones/nueva`. |
| `BADGE_LOCAL_DRAFT` | **[Pendiente producto]** — sugerencia corta: «Borrador local» o «Sin sincronizar» | Badge / estado visible en detalle wizard local-first. |
| `SECTIONS_OFFLINE_HINT` | **[Pendiente producto]** si hace falta distinto de cabecera | Coherencia con `CABECERA_HINT_READONLY` si se unifica un solo mensaje. |

Coordinar con producto solo las filas marcadas **[Pendiente producto]** antes de merge si el equipo exige copy aprobado.

---

## 6. Checklist previo al primer commit de PR-E2

- [ ] PR-E1 mergeado.
- [ ] Releer checklist § PR-E2 + smoke manual (flag OFF / ON / legacy URL).
- [ ] Copies `BADGE_*` / `NOT_FOUND_CTA` cerrados o explícitamente «sugerencia interna» en el PR.
- [ ] `pnpm test` + `tsc --noEmit` tras cada grupo de archivos tocados.

---

## 7. Nota sobre el PR de GitHub

El enlace del PR-E1 en GitHub lo genera quien lo abre desde el remoto; cuando exista, añadirlo al comentario de merge o a la descripción de PR-E2 para trazabilidad.
