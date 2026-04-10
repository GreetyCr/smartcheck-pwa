"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { generateInspectionPdfBlob } from "@/lib/pdf/generatePdf";
import type { PdfExportPayload } from "@/lib/pdf/types";
import { uploadPdfBlobToConvex } from "@/lib/pdf/uploadPdf";

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

type Props = { inspectionId: Id<"inspections"> };

export function InspectionPdfExport({ inspectionId }: Props) {
  const canExport = useQuery(api.users.exportPdfAllowed, {});
  const payload = useQuery(
    api.pdfs.getExportPayload,
    canExport === true ? { inspectionId } : "skip",
  );
  const latest = useQuery(api.pdfs.getLatestForInspection, {
    inspectionId,
  });
  const genUrl = useMutation(api.pdfs.generatePdfUploadUrl);
  const recordPdf = useMutation(api.pdfs.recordPdf);
  const [busy, setBusy] = useState(false);

  if (canExport !== true) {
    return null;
  }

  const handleGenerate = async () => {
    if (!payload) return;
    setBusy(true);
    try {
      const data = payload as PdfExportPayload;
      const blob = await generateInspectionPdfBlob(data);
      const name = buildFileName(data.inspection);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      a.click();
      URL.revokeObjectURL(href);

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const post = await genUrl();
        const storageId = await uploadPdfBlobToConvex(post, blob);
        await recordPdf({
          inspectionId,
          storageId,
          fileName: name,
          fileSize: blob.size,
        });
      } else if (typeof navigator !== "undefined") {
        alert(
          "PDF descargado en el dispositivo. Sin conexión: no se guardó en la nube; vuelve a generar cuando tengas red para archivarlo.",
        );
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo generar el PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-primary">Informe PDF</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Genera el reporte completo (solo administradores). Se descarga en el
            dispositivo y se guarda en la nube si hay conexión.
          </p>
          {latest ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Último PDF:{" "}
              {new Date(latest.generatedAt).toLocaleString("es-CR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-800">Aún no hay PDF guardado.</p>
          )}
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
    </div>
  );
}
