"use client";

import { ItemObservation } from "@/components/inspection/items/ItemObservation";
import {
  ItemPhotos,
  type PhotoEntry,
} from "@/components/inspection/items/ItemPhotos";
import { cn } from "@/lib/utils";
import type { SectionItem } from "@/lib/constants/sectionItems";
import {
  derivePhotoUi,
  type PhotoUiKind,
} from "@/lib/section-form-ui";

export type SelectFieldValue = {
  value: string;
  observation?: string;
};

type ItemSelectProps = {
  index: number;
  item: SectionItem;
  value: SelectFieldValue | undefined;
  onChange: (next: SelectFieldValue) => void;
  disabled?: boolean;
  photoEntries?: PhotoEntry[];
  onPickPhotos?: (files: File[]) => void | Promise<void>;
  onRemovePhoto?: (ref: string) => void;
};

const LABELS: Record<string, string> = {
  normal: "Normal",
  irregular: "Irregular",
  excesivo: "Excesivo",
  "2wd": "2WD",
  "4wd": "4WD",
  "4x4": "4x4",
};

export function ItemSelect({
  index,
  item,
  value,
  onChange,
  disabled,
  photoEntries,
  onPickPhotos,
  onRemovePhoto,
}: ItemSelectProps) {
  const opts = item.options ?? [];
  const { allowPhotos, photoKind, photoLabel } = derivePhotoUi(item);

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index}
        </span>
        {item.label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {opts.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange({
                value: opt,
                observation: value?.observation,
              })
            }
            className={cn(
              "rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors",
              value?.value === opt
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/50 text-foreground hover:bg-muted",
            )}
          >
            {LABELS[opt] ?? opt}
          </button>
        ))}
      </div>
      {item.showObservation ? (
        <div className="mt-3">
          <ItemObservation
            value={value?.observation ?? ""}
            onChange={(obs) => {
              if (!value?.value) return;
              onChange({ value: value.value, observation: obs });
            }}
            placeholder="Observaciones sobre el desgaste..."
            disabled={disabled || !value?.value}
            showMic
          />
        </div>
      ) : null}

      {allowPhotos &&
      (photoKind as PhotoUiKind) !== "none" &&
      onPickPhotos &&
      onRemovePhoto ? (
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
