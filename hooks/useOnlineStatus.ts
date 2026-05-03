"use client";

import { useState, useEffect } from "react";

/**
 * Detecta si la app está online u offline.
 */
export function useOnlineStatus(): boolean {
  // Mismo valor en SSR y primer render del cliente (evita hydration mismatch).
  // El valor real se aplica tras montar en el cliente.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    globalThis.addEventListener("online", onOnline);
    globalThis.addEventListener("offline", onOffline);
    return () => {
      globalThis.removeEventListener("online", onOnline);
      globalThis.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}
