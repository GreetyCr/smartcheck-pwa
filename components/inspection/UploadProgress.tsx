"use client";

import { Loader2 } from "lucide-react";

type UploadProgressProps = {
  pending: number;
  uploading: number;
};

export function UploadProgress({ pending, uploading }: UploadProgressProps) {
  if (pending === 0 && uploading === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-4 right-4 z-40 md:bottom-8">
      <div className="pointer-events-auto rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Subiendo fotos…
            </p>
            <p className="text-xs text-muted-foreground">
              {uploading > 0 ? `${uploading} en curso` : "En cola"}
              {pending > 0 ? ` · ${pending} pendiente(s)` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
