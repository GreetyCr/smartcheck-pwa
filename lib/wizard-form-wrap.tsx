"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type WizardFieldWrapProps = {
  fieldId: string;
  invalid?: boolean;
  children: ReactNode;
  className?: string;
};

/** Mismo resaltado ámbar que `SectionFormField` al validar secciones. */
export function WizardFieldWrap({
  fieldId,
  invalid,
  children,
  className,
}: WizardFieldWrapProps) {
  return (
    <div
      id={`wizard-field-${fieldId}`}
      className={cn(
        "scroll-mt-28 transition-shadow",
        invalid &&
          "rounded-xl ring-2 ring-amber-500 ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function scrollToFirstWizardField(fieldId: string) {
  if (typeof globalThis.document === "undefined") return;
  globalThis.document
    .getElementById(`wizard-field-${fieldId}`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}
