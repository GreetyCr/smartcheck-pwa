"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreVertical } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { VehicleCard } from "@/components/inspection/VehicleCard";
import { ProgressCard } from "@/components/inspection/ProgressCard";
import { SectionsList } from "@/components/inspection/SectionsList";
import { InspectionFooter } from "@/components/inspection/InspectionFooter";
import { InspectionPdfExport } from "@/components/inspection/InspectionPdfExport";
import { InspectionPdfStatus } from "@/components/inspection/InspectionPdfStatus";
import type { SectionRowStatus } from "@/components/inspection/SectionItem";
import { DashboardPageSkeleton } from "@/components/layout/DashboardPageSkeleton";
import { browserAlert, browserConfirm } from "@/lib/browser-confirm";
import { cn } from "@/lib/utils";
import { getInspectionSections } from "@/lib/constants/sections";

type Props = {
  inspectionId: Id<"inspections">;
};

export function InspectionSectionsScreen({ inspectionId }: Props) {
  const router = useRouter();
  const inspection = useQuery(api.inspections.get, { id: inspectionId });
  const sectionData = useQuery(api.sections.listSectionSummaries, {
    inspectionId,
  });
  const me = useQuery(api.users.getMe, {});

  const ensureRows = useMutation(api.sections.ensureSectionRows);
  const touchDraft = useMutation(api.sections.touchDraft);
  const discardInspection = useMutation(api.sections.discardInspection);

  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (inspection === undefined) return;
    if (inspection === null) return;
    void ensureRows({ inspectionId }).catch(() => {});
  }, [inspection, inspectionId, ensureRows]);

  useEffect(() => {
    if (typeof globalThis === "undefined" || !("location" in globalThis)) return;
    const win = globalThis as unknown as { location: { hash: string } };
    if (win.location.hash !== "#informe-pdf") return;
    const t = globalThis.setTimeout(() => {
      globalThis.document
        ?.getElementById("informe-pdf")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => globalThis.clearTimeout(t);
  }, [inspection, inspectionId]);

  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    try {
      await touchDraft({ inspectionId });
      setToast("Borrador guardado");
      globalThis.setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("No se pudo guardar");
      globalThis.setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  }, [inspectionId, touchDraft]);

  const handleShare = useCallback(async () => {
    const url =
      typeof globalThis !== "undefined" && "location" in globalThis
        ? (globalThis as unknown as { location: { href: string } }).location
            .href
        : "";
    const nav = navigator as unknown as {
      share?: (d: { title: string; url: string }) => Promise<void>;
      clipboard: { writeText: (s: string) => Promise<void> };
    };
    try {
      if (nav.share) {
        await nav.share({ title: "Inspección Smartcheck", url });
      } else {
        await nav.clipboard.writeText(url);
        setToast("Enlace copiado");
        globalThis.setTimeout(() => setToast(null), 2000);
      }
    } catch {
      /* usuario canceló share */
    }
  }, []);

  const handleDiscard = useCallback(async () => {
    if (!browserConfirm("¿Descartar esta inspección? Esta acción no se puede deshacer.")) {
      return;
    }
    try {
      await discardInspection({ inspectionId });
      router.replace("/");
    } catch {
      browserAlert("No se pudo eliminar la inspección.");
    }
  }, [discardInspection, inspectionId, router]);

  const visibleSections = useMemo(
    () => getInspectionSections(inspection?.transmissionType),
    [inspection?.transmissionType],
  );

  const summariesForList = useMemo(() => {
    if (sectionData === undefined || sectionData === null) {
      return [] as {
        table: string;
        status: SectionRowStatus;
        findings: number;
      }[];
    }
    const byTable = new Map(
      sectionData.summaries.map((s) => [String(s.table), s]),
    );
    return visibleSections.map((sec) => {
      const row = byTable.get(String(sec.table));
      return {
        table: sec.table,
        status: (row?.status ?? "pendiente") as SectionRowStatus,
        findings: row?.findings ?? 0,
      };
    });
  }, [sectionData, visibleSections]);

  const completedCount = summariesForList.filter(
    (s) => s.status === "completado",
  ).length;
  const totalSections = visibleSections.length;
  const progressPercent =
    totalSections > 0
      ? Math.round((completedCount / totalSections) * 100)
      : 0;

  if (inspection === undefined || sectionData === undefined) {
    return <DashboardPageSkeleton variant="detail" />;
  }

  if (inspection === null) {
    return (
      <div className="p-6">
        <p className="text-destructive">Inspección no encontrada o sin permiso.</p>
        <Link href="/" className="mt-2 inline-block text-primary underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (sectionData === null) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Inicia sesión para ver esta inspección.</p>
      </div>
    );
  }

  const plate =
    inspection.identifierType === "placa" && inspection.identifier
      ? inspection.identifier
      : inspection.identifier?.slice(-8) ?? "—";

  const brandModelYear = [
    inspection.vehicleBrand,
    inspection.vehicleModel,
    inspection.vehicleYear,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex min-h-dvh flex-col bg-[#F8F9FA] pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card px-2 py-3">
        <Link
          href="/"
          className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-muted"
          aria-label="Volver"
        >
          <ArrowLeft className="size-6" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-base font-bold text-primary">Inspección técnica</h1>
          <p className="text-xs text-muted-foreground">
            Orden #{String(inspectionId).slice(-6).toUpperCase()}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-muted"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical className="size-5" />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Cerrar menú"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-11 z-50 min-w-[220px] rounded-xl border border-border bg-card py-1 shadow-lg">
                <Link
                  href={`/inspecciones/${inspectionId}/cabecera`}
                  className="block px-4 py-2.5 text-sm hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  Editar datos del informe
                </Link>
                <Link
                  href={`/inspecciones/${inspectionId}#informe-pdf`}
                  className="block px-4 py-2.5 text-sm hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                  scroll={false}
                >
                  Ir al informe PDF
                </Link>
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-sm text-destructive hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    void handleDiscard();
                  }}
                >
                  Descartar inspección
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pt-4">
        <div className="space-y-2">
          <VehicleCard
            plate={plate}
            brandModelYear={brandModelYear || "Vehículo"}
          />
          <Link
            href={`/inspecciones/${inspectionId}/cabecera`}
            className="block w-full rounded-xl border border-border bg-card px-4 py-3 text-center text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-muted/50"
          >
            Editar datos del informe (cliente, vehículo, fotos)
          </Link>
        </div>
        <ProgressCard
          percent={progressPercent}
          completed={completedCount}
          total={totalSections}
        />
        {me?.role !== "admin" ? (
          <InspectionPdfStatus inspectionId={inspectionId} />
        ) : null}
        <SectionsList
          inspectionId={inspectionId}
          summaries={summariesForList}
          sections={visibleSections}
        />
        <InspectionPdfExport inspectionId={inspectionId} />
      </div>

      <InspectionFooter
        onSaveDraft={() => void handleSaveDraft()}
        onShare={() => void handleShare()}
        saving={saving}
      />

      {toast ? (
        <div
          className={cn(
            "fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium shadow-lg",
          )}
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
