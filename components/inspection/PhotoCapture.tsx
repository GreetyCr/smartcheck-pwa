"use client";

import { useCallback, useId, useRef } from "react";
import { Camera } from "lucide-react";
import { isImageLikeFile } from "@/lib/images/isImageLikeFile";
import { cn } from "@/lib/utils";

type PhotoCaptureProps = {
  onFiles: (files: File[]) => void | Promise<void>;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
};

/**
 * Entrada de archivos orientada a cámara (`capture=environment`).
 * En escritorio el SO puede ofrecer archivo o cámara según el navegador.
 */
export function PhotoCapture({
  onFiles,
  disabled,
  multiple = false,
  className,
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const onChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget as unknown as {
        files: FileList | null;
        value: string;
      };
      // Copiar antes de resetear: en Brave/Safari/Chromium vaciar `value` borra el FileList.
      const picked = input.files?.length ? Array.from(input.files) : [];
      input.value = "";
      const files = picked.filter((f) => isImageLikeFile(f));
      if (files.length) await onFiles(multiple ? files : files.slice(0, 1));
    },
    [multiple, onFiles],
  );

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        className="sr-only"
        onChange={onChange}
        disabled={disabled}
      />
      <label
        htmlFor={inputId}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-center text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
      >
        <Camera className="size-5 shrink-0" aria-hidden />
        <span>Agregar foto</span>
      </label>
    </>
  );
}
