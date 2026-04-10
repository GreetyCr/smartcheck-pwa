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
import { uploadFileToConvexStorage } from "@/lib/convex-storage";
import type { SectionConfig, ReadonlyUserContext } from "@/lib/constants/sectionItems";
import { getInspectionSections } from "@/lib/constants/sections";
import {
  countSectionProgress,
  docToFormState,
  formStateToPatch,
  validateSectionForm,
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
  const genUrl = useMutation(api.inspections.generateUploadUrl);

  const [state, setState] = useState<SectionFormState>({});
  const seeded = useRef(false);
  const userEdited = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  useEffect(() => {
    seeded.current = false;
    userEdited.current = false;
    setDirty(false);
    setState({});
  }, [sectionConfig.id]);

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
      window.setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
    }
  }, [inspectionId, sectionConfig, state, upsertSection]);

  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      void persist();
    }, 800);
    return () => window.clearTimeout(t);
  }, [state, dirty, persist]);

  const updateField = useCallback((key: string, value: unknown) => {
    userEdited.current = true;
    setDirty(true);
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const addPhotosForItem = useCallback(
    async (itemKey: string, files: File[]) => {
      const ids: Id<"_storage">[] = [];
      for (const file of files) {
        const post = await genUrl();
        const sid = await uploadFileToConvexStorage(post, file);
        ids.push(sid);
      }
      userEdited.current = true;
      setDirty(true);
      setState((prev) => {
        const photos = (prev.itemPhotos as Record<string, Id<"_storage">[]> | undefined) ?? {};
        const prevList = photos[itemKey] ?? [];
        return {
          ...prev,
          itemPhotos: {
            ...photos,
            [itemKey]: [...prevList, ...ids],
          },
        };
      });
    },
    [genUrl],
  );

  const removePhotoForItem = useCallback(
    (itemKey: string, storageId: Id<"_storage">) => {
      userEdited.current = true;
      setDirty(true);
      setState((prev) => {
        const photos = (prev.itemPhotos as Record<string, Id<"_storage">[]> | undefined) ?? {};
        const list = photos[itemKey] ?? [];
        return {
          ...prev,
          itemPhotos: {
            ...photos,
            [itemKey]: list.filter((id) => id !== storageId),
          },
        };
      });
    },
    [],
  );

  const onContinue = useCallback(async () => {
    const v = validateSectionForm(sectionConfig, state);
    if (!v.ok) {
      window.alert(v.message ?? "Revisa el formulario.");
      return;
    }
    await persist();
    const idx = routeSections.findIndex((s) => s.id === sectionConfig.id);
    const next = idx >= 0 ? routeSections[idx + 1] : undefined;
    if (next) {
      router.push(`/inspecciones/${inspectionId}/seccion/${next.id}`);
    } else {
      router.push(`/inspecciones/${inspectionId}`);
    }
  }, [inspectionId, persist, router, routeSections, sectionConfig, state]);

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
            photoEntries={photoEntries?.[item.key]}
            readonlyContext={readonlyContext}
            onChange={updateField}
            onPickPhotos={addPhotosForItem}
            onRemovePhoto={removePhotoForItem}
          />
        ))}
      </SectionFormShell>
      <SectionFooter onClick={() => void onContinue()} />
    </>
  );
}
