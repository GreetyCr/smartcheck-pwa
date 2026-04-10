"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, Car, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

type PhotoCaptureProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
};

export function PhotoCapture({
  file,
  onFileChange,
  label = "Foto de la Tarjeta de Circulación / Vehículo",
  className,
  disabled,
}: PhotoCaptureProps) {
  const menuId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      e.target.value = "";
      if (f && f.type.startsWith("image/")) onFileChange(f);
      setMenuOpen(false);
    },
    [onFileChange],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-foreground">{label}</p>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 shadow-sm",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <div className="relative aspect-4/3 w-full">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL del dispositivo
            <img
              src={previewUrl}
              alt="Vista previa del vehículo"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-linear-to-b from-muted/50 to-muted/80 text-muted-foreground">
              <Car className="size-16 opacity-40" strokeWidth={1.25} />
            </div>
          )}

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/25">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-white/90 transition-transform active:scale-95"
            >
              <Camera className="size-8" aria-hidden />
              <span className="sr-only">Abrir opciones de foto</span>
            </button>
            <span className="rounded-md bg-white/95 px-2 py-0.5 text-xs font-medium text-primary shadow">
              Actualizar Foto
            </span>
          </div>
        </div>

        {menuOpen ? (
          <div
            id={menuId}
            role="menu"
            className="absolute inset-x-3 bottom-3 z-10 flex flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-muted"
              onClick={() => {
                cameraRef.current?.click();
                setMenuOpen(false);
              }}
            >
              <Camera className="size-4 shrink-0" />
              Tomar foto
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-muted"
              onClick={() => {
                galleryRef.current?.click();
                setMenuOpen(false);
              }}
            >
              <ImagePlus className="size-4 shrink-0" />
              Seleccionar de galería
            </button>
          </div>
        ) : null}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPick}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
      </div>
    </div>
  );
}
