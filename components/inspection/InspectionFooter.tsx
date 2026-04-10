"use client";

import { Save, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InspectionFooterProps = {
  onSaveDraft: () => void;
  onShare: () => void;
  saving?: boolean;
  className?: string;
};

export function InspectionFooter({
  onSaveDraft,
  onShare,
  saving,
  className,
}: InspectionFooterProps) {
  return (
    <footer
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm",
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <Button
          type="button"
          size="lg"
          disabled={saving}
          onClick={onSaveDraft}
          className="h-12 min-w-0 flex-1 rounded-2xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Save className="size-5 shrink-0" data-icon="inline-start" />
          Guardar borrador
        </Button>
        <button
          type="button"
          onClick={onShare}
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-primary bg-card text-primary transition-colors hover:bg-muted"
          aria-label="Compartir"
        >
          <Share2 className="size-5" />
        </button>
      </div>
    </footer>
  );
}
