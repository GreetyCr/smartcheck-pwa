"use client";

import {
  ItemPhotos,
  type PhotoEntry,
} from "@/components/inspection/items/ItemPhotos";
import { formControlValue } from "@/lib/browser-confirm";
import type { SectionItem } from "@/lib/constants/sectionItems";
import {
  derivePhotoUi,
  type PhotoUiKind,
} from "@/lib/section-form-ui";

type ItemTextProps = {
  index: number;
  item: SectionItem;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  photoEntries?: PhotoEntry[];
  onPickPhotos?: (files: File[]) => void | Promise<void>;
  onRemovePhoto?: (ref: string) => void;
};

export function ItemText({
  index,
  item,
  value,
  onChange,
  disabled,
  photoEntries,
  onPickPhotos,
  onRemovePhoto,
}: ItemTextProps) {
  const { allowPhotos, photoKind, photoLabel } = derivePhotoUi(item);

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index}
        </span>
        {item.label}
      </h3>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(formControlValue(e))}
        placeholder={item.placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2"
      />

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
