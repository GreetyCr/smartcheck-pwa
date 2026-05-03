"use client";

import { useCallback, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { formControlValue } from "@/lib/browser-confirm";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/hooks/useGeolocation";

type LocationPickerProps = {
  value: string;
  onChange: (address: string) => void;
  /** Coordenadas tras GPS; `undefined` si el usuario edita el texto a mano. */
  onCoordsChange?: (
    coords: { lat: number; lng: number } | undefined,
  ) => void;
  className?: string;
};

async function reverseGeocodeEs(lat: number, lng: number): Promise<string> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "es",
      "User-Agent": "Smartcheck-PWA/1.0 (vehicle inspection; contact: app)",
    },
  });

  if (!res.ok) throw new Error("Reverse geocoding falló");

  const data = (await res.json()) as {
    display_name?: string;
  };

  return (
    data.display_name?.trim() ||
    `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  );
}

export function LocationPicker({
  value,
  onChange,
  onCoordsChange,
  className,
}: LocationPickerProps) {
  const [geoBusy, setGeoBusy] = useState(false);

  const handleCoords = useCallback(
    async ({ lat, lng }: { lat: number; lng: number }) => {
      setGeoBusy(true);
      try {
        const address = await reverseGeocodeEs(lat, lng);
        onChange(address);
        onCoordsChange?.({ lat, lng });
      } catch {
        const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onChange(fallback);
        onCoordsChange?.({ lat, lng });
      } finally {
        setGeoBusy(false);
      }
    },
    [onChange, onCoordsChange],
  );

  const { status, errorMessage, requestPosition } = useGeolocation({
    onSuccess: handleCoords,
  });

  const busy = status === "loading" || geoBusy;

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => requestPosition()}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/50 bg-card px-4 py-3.5 text-sm font-semibold text-primary transition-colors",
          "hover:border-primary hover:bg-primary/5 disabled:opacity-60",
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <MapPin className="size-5" aria-hidden />
        )}
        {busy ? "Obteniendo ubicación…" : "Obtener ubicación GPS"}
      </button>

      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}

      <div>
        <label htmlFor="location-manual" className="sr-only">
          Ubicación (editable)
        </label>
        <textarea
          id="location-manual"
          rows={3}
          placeholder="Dirección u observaciones de ubicación"
          value={value}
          onChange={(e) => {
            onCoordsChange?.(undefined);
            onChange(formControlValue(e));
          }}
          className="w-full resize-y rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
        />
      </div>
    </div>
  );
}
