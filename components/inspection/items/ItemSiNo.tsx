"use client";

import { cn } from "@/lib/utils";
import { ItemObservation } from "@/components/inspection/items/ItemObservation";
import { ItemPhotos, type PhotoEntry } from "@/components/inspection/items/ItemPhotos";
import type { SectionItem } from "@/lib/constants/sectionItems";
import { derivePhotoUi, type PhotoUiKind } from "@/lib/section-form-ui";

export type SnValue = {
  value: "si" | "no";
  observation?: string;
};

export type SnNaValue = {
  value: "si" | "no" | "na";
  observation?: string;
};

type ItemSiNoProps = {
  index: number;
  item: SectionItem;
  variant: "si_no" | "si_no_na";
  value: SnValue | SnNaValue | undefined;
  onChange: (next: SnValue | SnNaValue) => void;
  photoEntries: PhotoEntry[] | undefined;
  disabled?: boolean;
  onPickPhotos: (files: File[]) => void | Promise<void>;
  onRemovePhoto: (ref: string) => void;
};

export function ItemSiNo({
  index,
  item,
  variant,
  value,
  onChange,
  photoEntries,
  disabled,
  onPickPhotos,
  onRemovePhoto,
}: ItemSiNoProps) {
  const setVal = (v: "si" | "no" | "na") => {
    if (variant === "si_no" && v === "na") return;
    onChange({
      value: v,
      observation: value?.observation,
    } as SnValue | SnNaValue);
  };

  const multiline = Boolean(item.observationMultiline);
  const { allowPhotos, photoKind, photoLabel } = derivePhotoUi(item);
  const showObs = item.showObservation !== false;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {index}
          </span>
          {item.label}
        </h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-1 rounded-full bg-muted p-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setVal("si")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold transition-colors sm:px-4",
              value?.value === "si"
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground",
            )}
          >
            SÍ
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setVal("no")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold transition-colors sm:px-4",
              value?.value === "no"
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground",
            )}
          >
            NO
          </button>
          {variant === "si_no_na" ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setVal("na")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold transition-colors sm:px-4",
                value?.value === "na"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              N/A
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {showObs ? (
          <ItemObservation
            value={value?.observation ?? ""}
            onChange={(obs) => {
              if (!value?.value) return;
              onChange({ value: value.value, observation: obs });
            }}
            placeholder={
              item.observationPlaceholder ?? "Observaciones..."
            }
            multiline={multiline}
            disabled={disabled || !value?.value}
            showMic={multiline}
          />
        ) : null}

        {allowPhotos && (photoKind as PhotoUiKind) !== "none" ? (
          <ItemPhotos
            entries={photoEntries}
            variant={photoKind}
            label={photoLabel}
            multiple={photoKind !== "single_solid"}
            disabled={disabled}
            onPickFiles={onPickPhotos}
            onRemove={onRemovePhoto}
          />
        ) : null}
      </div>
    </section>
  );
}
