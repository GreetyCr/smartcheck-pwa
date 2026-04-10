"use client";

import { FileCheck } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Props = { inspectionId: Id<"inspections"> };

/** Indicador para técnicos: si ya existe PDF guardado en la nube. */
export function InspectionPdfStatus({ inspectionId }: Props) {
  const latest = useQuery(api.pdfs.getLatestForInspection, { inspectionId });

  if (latest === undefined) {
    return (
      <p className="text-center text-xs text-muted-foreground">PDF: …</p>
    );
  }

  if (!latest) {
    return (
      <p className="text-center text-xs text-muted-foreground">PDF: —</p>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 text-xs">
      <FileCheck className="size-3.5 text-emerald-700" aria-hidden />
      <span className="font-medium text-emerald-800">PDF generado</span>
      {latest.url ? (
        <a
          href={latest.url}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          Ver
        </a>
      ) : null}
    </div>
  );
}
