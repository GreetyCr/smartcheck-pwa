"use client";

import { useCallback, useRef } from "react";
import { Camera, ImageIcon, ImagePlus, Images, X } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import type { PhotoUiKind } from "@/lib/section-form-ui";

export type PhotoEntry = {
  storageId: Id<"_storage">;
  url: string | null;
};

type ItemPhotosProps = {
  entries: PhotoEntry[] | undefined;
  variant: PhotoUiKind;
  label: string;
  disabled?: boolean;
  multiple: boolean;
  onPickFiles: (files: File[]) => void | Promise<void>;
  onRemove: (storageId: Id<"_storage">) => void;
  className?: string;
};

function variantIcon(v: PhotoUiKind) {
  switch (v) {
    case "single_solid":
      return Camera;
    case "multiple_solid":
      return ImageIcon;
    case "multiple_dashed":
      return Images;
    default:
      return ImagePlus;
  }
}

export function ItemPhotos({
  entries,
  variant,
  label,
  disabled,
  multiple,
  onPickFiles,
  onRemove,
  className,
}: ItemPhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = variantIcon(variant);

  const onChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      e.target.value = "";
      if (!list?.length) return;
      const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
      if (files.length) await onPickFiles(multiple ? files : files.slice(0, 1));
    },
    [multiple, onPickFiles],
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  if (variant === "none") return null;

  const dashed = variant === "multiple_dashed";
  const solid = variant === "single_solid" || variant === "multiple_solid";

  return (
    <div className={cn("space-y-3", className)}>
      {entries?.length ? (
        <ul className="flex flex-wrap gap-2">
          {entries.map((e) => (
            <li key={e.storageId} className="relative size-20 overflow-hidden rounded-lg border bg-muted">
              {e.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.url}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                  …
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(e.storageId)}
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Quitar foto"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        capture={solid && !multiple ? "environment" : undefined}
        className="hidden"
        onChange={onChange}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold transition-colors",
          dashed &&
            "border-2 border-dashed border-border text-muted-foreground hover:bg-muted/60",
          solid &&
            "bg-muted text-foreground hover:bg-muted/80 dark:bg-slate-800",
        )}
      >
        <Icon className="size-5 shrink-0" />
        <span>{label}</span>
      </button>
    </div>
  );
}
