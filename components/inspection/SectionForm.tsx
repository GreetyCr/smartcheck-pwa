"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SectionFormShell } from "@/components/inspection/SectionFormShell";
import { SectionFooter } from "@/components/inspection/SectionFooter";
import { SectionFormField } from "@/components/inspection/SectionFormField";
import { InspectionBiClosingFields } from "@/components/inspection/InspectionBiClosingFields";
import { UploadProgress } from "@/components/inspection/UploadProgress";
import type { PhotoEntry } from "@/components/inspection/items/ItemPhotos";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import type { SectionConfig, ReadonlyUserContext } from "@/lib/constants/sectionItems";
import { browserAlert } from "@/lib/browser-confirm";
import { getInspectionSections } from "@/lib/constants/sections";
import { derivePhotoUi } from "@/lib/section-form-ui";
import {
  countSectionProgress,
  docToFormState,
  formStateToPatch,
  validateSectionFormDetailed,
  type SectionFormState,
} from "@/lib/section-form-utils";

type SectionFormProps = {
  sectionConfig: SectionConfig;
  inspectionId: Id<"inspections">;
};

export function SectionForm({ sectionConfig, inspectionId }: SectionFormProps) {
  const router = useRouter();
  const { user } = useUser();
  const inspection = useQuery(api.inspections.get, { id: inspectionId });
  const doc = useQuery(api.sections.getSection, {
    inspectionId,
    sectionTable: sectionConfig.table,
  });
  const photoEntries = useQuery(api.sections.getSectionItemPhotoEntries, {
    inspectionId,
    sectionTable: sectionConfig.table,
  });

  const upsertSection = useMutation(api.sections.upsertSection);

  const [state, setState] = useState<SectionFormState>({});
  const seeded = useRef(false);
  const userEdited = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [invalidKeys, setInvalidKeys] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const getSavedPhotoCount = useCallback(
    (itemKey: string) => {
      const photos =
        (state.itemPhotos as Record<string, unknown[]> | undefined) ?? {};
      return photos[itemKey]?.length ?? 0;
    },
    [state.itemPhotos],
  );

  const onPhotoUrl = useCallback((itemKey: string, url: string) => {
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
          [itemKey]: [...list, url],
        },
      };
    });
  }, []);

  const photoUpload = usePhotoUpload({
    inspectionId,
    sectionTable: sectionConfig.table,
    getSavedPhotoCount,
    onPhotoUrl,
  });
  const { awaitUploadsIdle, stats: uploadStats } = photoUpload;

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

  useEffect(() => {
    if (doc === undefined) return;
    if (seeded.current) return;
    if (userEdited.current) return;

    let next = docToFormState(
      doc as unknown as Record<string, unknown>,
      sectionConfig,
    );

    if (sectionConfig.id === "finalizacion") {
      const name =
        (doc as { nombre_inspector?: string }).nombre_inspector ??
        user?.fullName ??
        user?.firstName ??
        "";
      const ts =
        (doc as { fecha_hora?: number }).fecha_hora ?? Date.now();
      next = {
        ...next,
        nombre_inspector: name,
        fecha_hora: ts,
        comentario_final:
          typeof next.comentario_final === "string"
            ? next.comentario_final
            : (doc as { comentario_final?: { texto?: string } })
                  .comentario_final?.texto ?? "",
      };
    }

    setState(next);
    seeded.current = true;
  }, [doc, sectionConfig, user?.firstName, user?.fullName]);

  const progress = useMemo(
    () => countSectionProgress(sectionConfig.items, state),
    [sectionConfig.items, state],
  );

  const persist = useCallback(async () => {
    const patch = formStateToPatch(state, sectionConfig);
    if (Object.keys(patch).length === 0) {
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    try {
      await upsertSection({
        inspectionId,
        sectionTable: sectionConfig.table,
        data: patch,
      });
      setSaveStatus("saved");
      globalThis.setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      setSaveStatus("idle");
      browserAlert(
        e instanceof Error ? e.message : "No se pudo guardar la sección.",
      );
    }
  }, [inspectionId, sectionConfig, state, upsertSection]);

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

  const addPhotosForItem = useCallback(
    async (itemKey: string, files: File[]) => {
      await photoUpload.addPhotosForItem(itemKey, files);
    },
    [photoUpload],
  );

  const removePhotoForItem = useCallback(
    async (itemKey: string, ref: string) => {
      const pend = photoUpload.pendingForItem(itemKey);
      if (pend.some((p) => p.id === ref)) {
        await photoUpload.removePendingPhoto(itemKey, ref);
        return;
      }
      userEdited.current = true;
      setDirty(true);
      setState((prev) => {
        const photos =
          (prev.itemPhotos as Record<string, (Id<"_storage"> | string)[]> | undefined) ??
          {};
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
    [photoUpload],
  );

  const mergedPhotoEntries = useMemo(() => {
    const out: Record<string, PhotoEntry[]> = {};
    for (const item of sectionConfig.items) {
      if (!derivePhotoUi(item).allowPhotos) continue;
      const server = photoEntries?.[item.key] ?? [];
      const pend = photoUpload.pendingForItem(item.key).map(
        (p): PhotoEntry => ({
          ref: p.id,
          url: p.previewUrl,
          status: p.status,
          errorMessage: p.errorMessage,
        }),
      );
      const saved: PhotoEntry[] = server.map((e) => ({
        ref: e.ref,
        url: e.url,
        status: "done",
      }));
      out[item.key] = [...pend, ...saved];
    }
    return out;
  }, [photoEntries, photoUpload, sectionConfig.items]);

  const onContinue = useCallback(async () => {
    try {
      await awaitUploadsIdle();
    } catch (e) {
      browserAlert(
        e instanceof Error ? e.message : "Esperando la subida de fotos…",
      );
      return;
    }

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
      router.push(`/inspecciones/${inspectionId}/seccion/${next.id}`);
    } else {
      router.push(`/inspecciones/${inspectionId}`);
    }
  }, [
    awaitUploadsIdle,
    inspectionId,
    persist,
    router,
    routeSections,
    sectionConfig,
    state,
  ]);

  useEffect(() => {
    if (inspection === undefined) return;
    if (inspection === null) return;
    const allowed = routeSections.some((s) => s.id === sectionConfig.id);
    if (!allowed) {
      router.replace(`/inspecciones/${inspectionId}`);
    }
  }, [inspection, inspectionId, router, routeSections, sectionConfig.id]);

  const total = sectionConfig.items.length;

  return (
    <>
      <SectionFormShell
        title={sectionConfig.name}
        backHref={`/inspecciones/${inspectionId}`}
        progressCurrent={progress}
        progressTotal={total}
        saveStatus={saveStatus}
      >
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
            onPickPhotos={addPhotosForItem}
            onRemovePhoto={removePhotoForItem}
          />
        ))}
        {sectionConfig.id === "finalizacion" ? (
          <InspectionBiClosingFields inspectionId={inspectionId} />
        ) : null}
      </SectionFormShell>
      <UploadProgress
        pending={uploadStats.pending}
        uploading={uploadStats.uploading}
      />
      <SectionFooter
        onClick={() => void onContinue()}
        disabled={uploadStats.active > 0}
        label={
          uploadStats.active > 0 ? "Subiendo fotos…" : "Guardar y continuar"
        }
      />
    </>
  );
}
