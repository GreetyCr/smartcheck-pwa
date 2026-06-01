"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { SectionConfig, ReadonlyUserContext } from "@/lib/constants/sectionItems";
import { SectionFormShell } from "@/components/inspection/SectionFormShell";
import { SectionFooter } from "@/components/inspection/SectionFooter";
import { SectionFormField } from "@/components/inspection/SectionFormField";
import { DashboardPageSkeleton } from "@/components/layout/DashboardPageSkeleton";
import type { PhotoEntry } from "@/components/inspection/items/ItemPhotos";
import { useLocalSectionPhotos } from "@/hooks/useLocalSectionPhotos";
import { useOfflineInspection } from "@/hooks/useOfflineInspection";
import {
  inspectionPathSegment,
  useInspectionRoute,
} from "@/components/inspection/InspectionRouteResolver";
import { browserAlert } from "@/lib/browser-confirm";
import { getInspectionSections } from "@/lib/constants/sections";
import { derivePhotoUi } from "@/lib/section-form-ui";
import {
  countSectionProgress,
  validateSectionFormDetailed,
  type SectionFormState,
} from "@/lib/section-form-utils";
import {
  localSectionDoc,
  seedSectionFormState,
  toUpsertPayload,
} from "@/lib/offline/sectionLocal";
import { INSPECTION_ROUTE_COPY } from "@/lib/inspection/inspectionRouteCopy";
import { inspectionSectionHref } from "@/lib/inspection/sectionPaths";

type Props = { sectionConfig: SectionConfig };

/** Formulario de sección solo IDB (sin `convexId`); sync vía `processSyncQueue`. */
export function SectionFormLocal({ sectionConfig }: Props) {
  const router = useRouter();
  const routeCtx = useInspectionRoute();
  const pathSeg = inspectionPathSegment(routeCtx);
  const { user } = useUser();

  const offline = useOfflineInspection({
    inspectionId: routeCtx.routeRef,
    convexInspectionIdForOnline: routeCtx.convexInspectionId,
  });

  const inspection = offline.inspection;
  const localId = offline.localRow?.localId ?? routeCtx.routeRef;

  const [state, setState] = useState<SectionFormState>({});
  const seeded = useRef(false);
  const userEdited = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [invalidKeys, setInvalidKeys] = useState<Set<string>>(new Set());

  const getSavedPhotoCount = useCallback(
    (itemKey: string) => {
      const photos =
        (state.itemPhotos as Record<string, unknown[]> | undefined) ?? {};
      return photos[itemKey]?.length ?? 0;
    },
    [state.itemPhotos],
  );

  const onPhotoRef = useCallback((itemKey: string, ref: string) => {
    userEdited.current = true;
    setDirty(true);
    setState((prev) => {
      const photos =
        (prev.itemPhotos as Record<string, string[]> | undefined) ?? {};
      const list = photos[itemKey] ?? [];
      return {
        ...prev,
        itemPhotos: {
          ...photos,
          [itemKey]: [...list, ref],
        },
      };
    });
  }, []);

  const localPhotos = useLocalSectionPhotos({
    inspectionLocalId: localId,
    sectionTable: sectionConfig.table,
    getSavedPhotoCount,
    onPhotoRef,
  });

  const readonlyContext: ReadonlyUserContext = useMemo(
    () => ({
      name: user?.fullName ?? user?.firstName ?? undefined,
      email: user?.primaryEmailAddress?.emailAddress ?? undefined,
    }),
    [user?.fullName, user?.firstName, user?.primaryEmailAddress?.emailAddress],
  );

  const routeSections = useMemo(
    () => getInspectionSections(inspection?.transmissionType),
    [inspection?.transmissionType],
  );

  const sectionDoc = useMemo(
    () => localSectionDoc(offline.localRow?.sections, sectionConfig.table),
    [offline.localRow?.sections, sectionConfig.table],
  );

  useEffect(() => {
    if (offline.isLoading || seeded.current || userEdited.current) return;
    const next = seedSectionFormState(sectionDoc, sectionConfig, {
      nombre_inspector: user?.fullName ?? user?.firstName ?? "",
      fecha_hora: Date.now(),
    });
    setState(next);
    seeded.current = true;
  }, [
    offline.isLoading,
    sectionDoc,
    sectionConfig,
    user?.firstName,
    user?.fullName,
  ]);

  const progress = useMemo(
    () => countSectionProgress(sectionConfig.items, state),
    [sectionConfig.items, state],
  );

  const persist = useCallback(async () => {
    const patch = toUpsertPayload(state, sectionConfig);
    if (Object.keys(patch).length === 0) return;
    try {
      await offline.saveSection(sectionConfig.table, patch);
    } catch (e) {
      browserAlert(
        e instanceof Error ? e.message : "No se pudo guardar la sección.",
      );
    }
  }, [offline, sectionConfig, state]);

  useEffect(() => {
    if (!dirty) return;
    const t = globalThis.setTimeout(() => {
      void persist();
    }, 800);
    return () => globalThis.clearTimeout(t);
  }, [state, dirty, persist]);

  const updateField = useCallback((key: string, value: unknown) => {
    userEdited.current = true;
    setDirty(true);
    setInvalidKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const removePhotoForItem = useCallback(
    async (itemKey: string, ref: string) => {
      if (localPhotos.pendingForItem(itemKey).some((p) => p.id === ref)) {
        await localPhotos.removePendingPhoto(itemKey, ref);
      }
      userEdited.current = true;
      setDirty(true);
      setState((prev) => {
        const photos =
          (prev.itemPhotos as Record<string, string[]> | undefined) ?? {};
        const list = photos[itemKey] ?? [];
        return {
          ...prev,
          itemPhotos: {
            ...photos,
            [itemKey]: list.filter((x) => String(x) !== ref),
          },
        };
      });
    },
    [localPhotos],
  );

  const mergedPhotoEntries = useMemo(() => {
    const out: Record<string, PhotoEntry[]> = {};
    for (const item of sectionConfig.items) {
      if (!derivePhotoUi(item).allowPhotos) continue;
      out[item.key] = localPhotos.photoEntriesForItem(item.key);
    }
    return out;
  }, [localPhotos, sectionConfig.items]);

  const onContinue = useCallback(async () => {
    const v = validateSectionFormDetailed(sectionConfig, state);
    if (!v.ok) {
      const keys = new Set(v.errors.map((e) => e.key));
      setInvalidKeys(keys);
      browserAlert(
        v.errors.length > 1
          ? `${v.errors[0]?.message ?? "Revisa el formulario."} (${v.errors.length} campos pendientes)`
          : (v.errors[0]?.message ?? "Revisa el formulario."),
      );
      const first = v.errors[0]?.key;
      if (first && typeof globalThis.document !== "undefined") {
        globalThis.document
          .getElementById(`section-field-${first}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    setInvalidKeys(new Set());
    await persist();
    const idx = routeSections.findIndex((s) => s.id === sectionConfig.id);
    const next = idx >= 0 ? routeSections[idx + 1] : undefined;
    if (next) {
      router.push(inspectionSectionHref(pathSeg, next.id));
    } else {
      router.push(`/inspecciones/${pathSeg}`);
    }
  }, [pathSeg, persist, router, routeSections, sectionConfig, state]);

  useEffect(() => {
    if (inspection === undefined || inspection === null) return;
    const allowed = routeSections.some((s) => s.id === sectionConfig.id);
    if (!allowed) {
      router.replace(`/inspecciones/${pathSeg}`);
    }
  }, [inspection, pathSeg, router, routeSections, sectionConfig.id]);

  const total = sectionConfig.items.length;

  if (offline.isLoading) {
    return <DashboardPageSkeleton variant="form" />;
  }

  if (!inspection || !offline.localRow) {
    return (
      <div className="p-6">
        <p className="text-destructive">Inspección no encontrada o sin permiso.</p>
        <Link href="/" className="mt-2 inline-block text-primary underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <>
      <SectionFormShell
        title={sectionConfig.name}
        backHref={`/inspecciones/${pathSeg}`}
        progressCurrent={progress}
        progressTotal={total}
      >
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {INSPECTION_ROUTE_COPY.SECTIONS_OFFLINE_HINT}
        </p>
        {sectionConfig.id === "finalizacion" ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Esta inspección es un documento técnico orientativo. El taller o comprador
            asume la responsabilidad de verificar el estado real del vehículo.
          </p>
        ) : null}
        {sectionConfig.items.map((item, i) => (
          <SectionFormField
            key={item.key}
            index={i + 1}
            item={item}
            value={state[item.key]}
            photoEntries={mergedPhotoEntries[item.key]}
            fieldInvalid={invalidKeys.has(item.key)}
            readonlyContext={readonlyContext}
            onChange={updateField}
            onPickPhotos={localPhotos.addPhotosForItem}
            onRemovePhoto={removePhotoForItem}
          />
        ))}
      </SectionFormShell>
      <SectionFooter
        onClick={() => void onContinue()}
        disabled={false}
        label="Guardar y continuar"
      />
    </>
  );
}
