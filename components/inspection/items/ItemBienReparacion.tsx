"use client";

import { Ban, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemObservation } from "@/components/inspection/items/ItemObservation";
import { ItemPhotos, type PhotoEntry } from "@/components/inspection/items/ItemPhotos";
import type { SectionItem } from "@/lib/constants/sectionItems";
import {
  derivePhotoUi,
  okButtonLabelFor,
  type PhotoUiKind,
} from "@/lib/section-form-ui";

export type BrValue = {
  value: "bien" | "reparacion";
  observation?: string;
};

export type BrNaValue = {
  value: "bien" | "reparacion" | "na";
  observation?: string;
};

type ItemBienReparacionProps = {
  index: number;
  item: SectionItem;
  /** Catálogo: 2 o 3 opciones. */
  variant: "bien_reparacion" | "bien_reparacion_na";
  value: BrValue | BrNaValue | undefined;
  onChange: (next: BrValue | BrNaValue) => void;
  photoEntries: PhotoEntry[] | undefined;
  disabled?: boolean;
  onPickPhotos: (files: File[]) => void | Promise<void>;
  onRemovePhoto: (ref: string) => void;
};

export function ItemBienReparacion({
  index,
  item,
  variant,
  value,
  onChange,
  photoEntries,
  disabled,
  onPickPhotos,
  onRemovePhoto,
}: ItemBienReparacionProps) {
  const okText =
    okButtonLabelFor(item) === "bien" ? "Bien" : "Está bien";
  const showObs = item.showObservation !== false;
  const { allowPhotos, photoKind, photoLabel } = derivePhotoUi(item);

  const setVal = (v: "bien" | "reparacion" | "na") => {
    if (variant === "bien_reparacion") {
      if (v === "na") return;
      onChange({
        value: v as "bien" | "reparacion",
        observation: value?.observation,
      });
      return;
    }
    onChange({
      value: v,
      observation: value?.observation,
    });
  };

  const cols = variant === "bien_reparacion_na" ? 3 : 2;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {item.subtitle ? (
        <p className="mb-1 text-xs text-muted-foreground">{item.subtitle}</p>
      ) : null}
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index}
        </span>
        {item.label}
      </h3>

      <div className="rounded-lg bg-muted p-1">
        <div
          className={cn(
            "grid min-h-14 gap-2",
            cols === 3 ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => setVal("bien")}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 px-1 py-2 text-center transition-all",
              value?.value === "bien"
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-transparent bg-background/80 text-muted-foreground hover:border-border",
            )}
          >
            <CheckCircle className="mb-0.5 size-4" />
            <span className="text-[11px] font-bold uppercase leading-tight">
              {okText}
            </span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setVal("reparacion")}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 px-1 py-2 text-center transition-all",
              value?.value === "reparacion"
                ? "border-orange-500 bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-100"
                : "border-transparent bg-background/80 text-muted-foreground hover:border-border",
            )}
          >
            <AlertTriangle className="mb-0.5 size-4" />
            <span className="text-[11px] font-bold uppercase leading-tight">
              Atención
            </span>
          </button>
          {variant === "bien_reparacion_na" ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setVal("na")}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 px-1 py-2 text-center transition-all",
                value?.value === "na"
                  ? "border-slate-400 bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  : "border-transparent bg-background/80 text-muted-foreground hover:border-border",
              )}
            >
              <Ban className="mb-0.5 size-4" />
              <span className="text-[11px] font-bold uppercase">N/A</span>
            </button>
          ) : null}
        </div>
      </div>

      {showObs ? (
        <div className="mt-3">
          <ItemObservation
            value={
              value && "observation" in value ? (value.observation ?? "") : ""
            }
            onChange={(obs) => {
              if (!value?.value) return;
              onChange({ ...value, observation: obs } as BrValue | BrNaValue);
            }}
            placeholder={
              item.observationPlaceholder ?? "Observaciones..."
            }
            disabled={disabled || !value?.value}
            showMic
          />
        </div>
      ) : null}

      {allowPhotos && (photoKind as PhotoUiKind) !== "none" ? (
        <div className="mt-3">
          <ItemPhotos
            entries={photoEntries}
            variant={photoKind}
            label={photoLabel}
            multiple={photoKind !== "single_solid"}
            disabled={disabled}
            onPickFiles={onPickPhotos}
            onRemove={onRemovePhoto}
          />
        </div>
      ) : null}
    </section>
  );
}
