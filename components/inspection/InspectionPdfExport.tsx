"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, ExternalLink, FileText, Loader2, Truck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { browserAlert } from "@/lib/browser-confirm";
import { generateInspectionPdfBlob } from "@/lib/pdf/generatePdf";
import type { PdfExportPayload } from "@/lib/pdf/types";
import { uploadPdfBlobToConvex } from "@/lib/pdf/uploadPdf";
import { cn } from "@/lib/utils";

type WebDownloadLink = { href: string; download: string; click: () => void };

function buildFileName(inspection: Record<string, unknown>): string {
  const raw = String(inspection.identifier ?? "sin-placa")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const ts = inspection._creationTime as number | undefined;
  const day = ts
    ? new Date(ts).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return `Smartcheck_${raw}_${day}.pdf`;
}

function triggerPdfDownload(blob: Blob, name: string): void {
  const href = URL.createObjectURL(blob);
  const d = (globalThis as unknown as {
    document: { createElement: (t: string) => WebDownloadLink };
  }).document;
  const a = d.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  globalThis.setTimeout(() => URL.revokeObjectURL(href), 4000);
}

type Props = { inspectionId: Id<"inspections"> };

function formatPdfSavedAt(generatedAt: number | undefined): string {
  if (generatedAt == null || !Number.isFinite(generatedAt)) return "—";
  return new Date(generatedAt).toLocaleString("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function InspectionPdfExport({ inspectionId }: Props) {
  const canExport = useQuery(api.users.exportPdfAllowed, {});
  const inspection = useQuery(
    api.inspections.get,
    canExport === true ? { id: inspectionId } : "skip",
  );
  const payload = useQuery(
    api.pdfs.getExportPayload,
    canExport === true ? { inspectionId } : "skip",
  );
  const latest = useQuery(api.pdfs.getLatestForInspection, {
    inspectionId,
  });
  const genUrl = useMutation(api.pdfs.generatePdfUploadUrl);
  const recordPdf = useMutation(api.pdfs.recordPdf);
  const markReportDelivered = useMutation(api.inspections.markReportDelivered);
  const [busy, setBusy] = useState(false);
  const [deliverBusy, setDeliverBusy] = useState(false);
  const [cloudJustSaved, setCloudJustSaved] = useState(false);

  if (canExport !== true) {
    return null;
  }

  const deliveredAt = inspection?.reportDeliveredAt;
  const latestLoading = latest === undefined;
  const hasPdfInCloud = Boolean(latest);

  const handleGenerate = async () => {
    if (!payload) return;
    setBusy(true);
    setCloudJustSaved(false);
    try {
      const data = payload as PdfExportPayload;
      const blob = await generateInspectionPdfBlob(data);
      const name = buildFileName(data.inspection);

      /**
       * Orden importante en iOS Safari: primero subir a Convex y registrar la fila,
       * luego disparar la descarga local. Si se hace al revés, la descarga puede
       * competir con el POST al storage y la subida falla sin mensaje claro.
       */
      let postUrl: string;
      try {
        postUrl = await genUrl();
      } catch (e) {
        triggerPdfDownload(blob, name);
        browserAlert(
          `[1/3 Pedir URL de subida] Falló: ${
            e instanceof Error ? e.message : String(e)
          }. Se descargó el PDF en el dispositivo; no quedó en la nube.`,
        );
        return;
      }

      let storageId: Id<"_storage">;
      try {
        storageId = await uploadPdfBlobToConvex(postUrl, blob);
      } catch (e) {
        triggerPdfDownload(blob, name);
        browserAlert(
          `[2/3 Subir archivo a almacenamiento] Falló: ${
            e instanceof Error ? e.message : String(e)
          }. Se descargó el PDF localmente. Causas frecuentes en iPhone: red inestable, modo datos limitados, o extensión/PWA que bloquea dominios externos (Convex).`,
        );
        return;
      }

      try {
        await recordPdf({
          inspectionId,
          storageId,
          fileName: name,
          fileSize: blob.size,
        });
      } catch (e) {
        triggerPdfDownload(blob, name);
        browserAlert(
          `[3/3 Registrar PDF en la base de datos] Falló: ${
            e instanceof Error ? e.message : String(e)
          }. El archivo puede haberse subido al storage pero sin enlace en la app; contacta soporte con este mensaje. Se descargó el PDF en el dispositivo.`,
        );
        return;
      }

      setCloudJustSaved(true);
      globalThis.setTimeout(() => setCloudJustSaved(false), 5000);
      triggerPdfDownload(blob, name);
    } catch (e) {
      browserAlert(
        e instanceof Error ? e.message : "No se pudo generar el PDF",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleMarkDelivered = async () => {
    setDeliverBusy(true);
    try {
      await markReportDelivered({ inspectionId });
    } catch (e) {
      browserAlert(
        e instanceof Error ? e.message : "No se pudo registrar la entrega.",
      );
    } finally {
      setDeliverBusy(false);
    }
  };

  return (
    <div
      id="informe-pdf"
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-primary">Informe PDF</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Genera el reporte completo. Se descarga en el dispositivo y se guarda
            en la nube si hay conexión.
          </p>
          {latestLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Comprobando si hay PDF en la nube…
            </p>
          ) : latest ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Último PDF: {formatPdfSavedAt(latest.generatedAt)}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-800">Aún no hay PDF guardado.</p>
          )}
          {cloudJustSaved ? (
            <p className="mt-2 text-xs font-medium text-emerald-800">
              PDF guardado en la nube correctamente.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          className="shrink-0 gap-2 rounded-xl bg-[#1E3A5F] font-semibold"
          disabled={busy || payload === undefined}
          onClick={() => void handleGenerate()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <FileText className="size-4" aria-hidden />
          )}
          {busy ? "Generando…" : "Generar PDF"}
        </Button>
      </div>
      {latest?.url ? (
        <a
          href={latest.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ExternalLink className="size-4" aria-hidden />
          Abrir último PDF en la nube
        </a>
      ) : null}

      {deliveredAt ? (
        <div
          className={cn(
            "mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-950",
          )}
        >
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-emerald-600"
            aria-hidden
          />
          <div>
            <p className="font-semibold">Informe entregado</p>
            <p className="text-xs text-emerald-900/90">
              Registrado el{" "}
              {new Date(deliveredAt).toLocaleString("es-CR", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>
      ) : hasPdfInCloud ? (
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Cuando el informe impreso o digital haya sido entregado al cliente,
            regístralo aquí para seguimiento.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 gap-2 rounded-xl border-[#FF8C00] text-[#1E3A5F] hover:bg-[#FF8C00]/10"
            disabled={deliverBusy}
            onClick={() => void handleMarkDelivered()}
          >
            {deliverBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Truck className="size-4" aria-hidden />
            )}
            Marcar como entregado
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Tras generar y guardar el PDF en la nube, podrás marcar el informe como
          entregado.
        </p>
      )}
    </div>
  );
}
