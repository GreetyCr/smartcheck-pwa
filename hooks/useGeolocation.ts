"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeolocationStatus = "idle" | "loading" | "success" | "error";

export type GeolocationState = {
  status: GeolocationStatus;
  coords: { lat: number; lng: number } | null;
  errorMessage: string | null;
};

type UseGeolocationOptions = {
  /** Se invoca cuando hay coordenadas nuevas (útil para reverse geocoding). */
  onSuccess?: (coords: { lat: number; lng: number }) => void;
};

/** Solicita la posición actual del dispositivo (sin reverse geocoding). */
export function useGeolocation(options?: UseGeolocationOptions) {
  const onSuccessRef = useRef(options?.onSuccess);
  useEffect(() => {
    onSuccessRef.current = options?.onSuccess;
  }, [options?.onSuccess]);

  const [state, setState] = useState<GeolocationState>({
    status: "idle",
    coords: null,
    errorMessage: null,
  });

  const requestPosition = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({
        status: "error",
        coords: null,
        errorMessage: "Geolocalización no disponible en este navegador.",
      });
      return;
    }

    setState((s) => ({
      ...s,
      status: "loading",
      errorMessage: null,
    }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setState({
          status: "success",
          coords,
          errorMessage: null,
        });
        onSuccessRef.current?.(coords);
      },
      (err) => {
        let msg = "No se pudo obtener la ubicación.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Permiso de ubicación denegado.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Ubicación no disponible.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Tiempo de espera agotado.";
        }
        setState({
          status: "error",
          coords: null,
          errorMessage: msg,
        });
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 },
    );
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", coords: null, errorMessage: null });
  }, []);

  return { ...state, requestPosition, reset };
}
