"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Clock,
  Download,
  ImageIcon,
  ImagePlus,
  Images,
  Loader2,
  X,
} from "lucide-react";
import { PhotoCapture } from "@/components/inspection/PhotoCapture";
import { browserAlert } from "@/lib/browser-confirm";
import { saveImageToDevice } from "@/lib/saveImageToDevice";
import { cn } from "@/lib/utils";
import type { PhotoUiKind } from "@/lib/section-form-ui";
import { MAX_PHOTOS_PER_ITEM } from "@/lib/constants/photos";
import { isImageLikeFile } from "@/lib/images/isImageLikeFile";

export type PhotoEntry = {
  ref: string;
  url: string | null;
  status?: "pending" | "uploading" | "error" | "done";
  errorMessage?: string;
};

type ItemPhotosProps = {
  entries: PhotoEntry[] | undefined;
  variant: PhotoUiKind;
  label: string;
  disabled?: boolean;
  multiple: boolean;
  maxPhotos?: number;
  onPickFiles: (files: File[]) => void | Promise<void>;
  onRemove: (ref: string) => void;
  className?: string;
};

function VariantPickIcon({ variant }: { variant: Exclude<PhotoUiKind, "none"> }) {
  const cls = "size-5 shrink-0";
  switch (variant) {
    case "single_solid":
      return <Camera className={cls} aria-hidden />;
    case "multiple_solid":
      return <ImageIcon className={cls} aria-hidden />;
    case "multiple_dashed":
      return <Images className={cls} aria-hidden />;
    default:
      return <ImagePlus className={cls} aria-hidden />;
  }
}

export function ItemPhotos({
  entries,
  variant,
  label,
  disabled,
  multiple,
  maxPhotos = MAX_PHOTOS_PER_ITEM,
  onPickFiles,
  onRemove,
  className,
}: ItemPhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [savingRef, setSavingRef] = useState<string | null>(null);

  const savePhotoToPhone = useCallback(
    async (url: string, indexOneBased: number, ref: string) => {
      setSavingRef(ref);
      try {
        await saveImageToDevice(url, label, indexOneBased);
      } catch {
        const w = globalThis.window.open(url, "_blank", "noopener,noreferrer");
        if (!w) {
          browserAlert(
            "No se pudo guardar la imagen automáticamente. Mantén pulsada la miniatura y elige «Añadir a fotos» o «Guardar imagen».",
          );
        }
      } finally {
        setSavingRef(null);
      }
    },
    [label],
  );

  const onChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget as unknown as {
        files: FileList | null;
        value: string;
      };
      const picked = input.files?.length ? Array.from(input.files) : [];
      input.value = "";
      const files = picked.filter((f) => isImageLikeFile(f));
      if (files.length) await onPickFiles(multiple ? files : files.slice(0, 1));
    },
    [multiple, onPickFiles],
  );

  const openPicker = useCallback(() => {
    const el = inputRef.current as unknown as { click: () => void } | null;
    el?.click();
  }, []);

  if (variant === "none") return null;

  const dashed = variant === "multiple_dashed";
  const solid = variant === "single_solid" || variant === "multiple_solid";
  const count = entries?.length ?? 0;
  const canAddMore = count < maxPhotos;

  return (
    <div className={cn("space-y-3", className)}>
      {entries?.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {entries.map((e, photoIndex) => {
            const canSaveToDevice =
              Boolean(e.url) &&
              e.status !== "uploading" &&
              e.status !== "error";
            return (
            <li
              key={e.ref}
              className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              {e.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.url}
                  alt=""
                  className={cn(
                    "size-full object-cover",
                    (e.status === "pending" ||
                      e.status === "uploading" ||
                      e.status === "error") &&
                      "opacity-70",
                  )}
                />
              ) : (
                <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                  …
                </div>
              )}
              {e.status === "uploading" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2 className="size-7 animate-spin text-primary" />
                </div>
              ) : e.status === "pending" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <Clock className="size-7 text-amber-400" />
                </div>
              ) : e.status === "error" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 p-1">
                  <AlertCircle className="size-6 text-red-400" />
                  {e.errorMessage ? (
                    <span className="line-clamp-2 text-center text-[10px] text-white">
                      {e.errorMessage}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {canSaveToDevice ? (
                <button
                  type="button"
                  disabled={disabled || savingRef === e.ref}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (!e.url) return;
                    void savePhotoToPhone(e.url, photoIndex + 1, e.ref);
                  }}
                  className="absolute bottom-1 left-1 flex size-7 items-center justify-center rounded-full bg-black/65 text-white shadow-md transition-opacity hover:bg-black/80 disabled:opacity-50"
                  aria-label={`Guardar en el teléfono: ${label}`}
                  title="Guardar en el teléfono"
                >
                  {savingRef === e.ref ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Download className="size-3.5" aria-hidden />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onRemove(e.ref)}
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Quitar foto"
              >
                <X className="size-3.5" />
              </button>
            </li>
            );
          })}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        capture="environment"
        className="hidden"
        onChange={onChange}
      />

      {canAddMore ? (
        dashed ? (
          <PhotoCapture
            onFiles={onPickFiles}
            disabled={disabled}
            multiple={multiple}
            className="w-full"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={openPicker}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold transition-colors",
              solid &&
                "bg-muted text-foreground hover:bg-muted/80 dark:bg-slate-800",
            )}
          >
            <VariantPickIcon variant={variant} />
            <span>{label}</span>
          </button>
        )
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        {count} de {maxPhotos} fotos
      </p>
    </div>
  );
}
