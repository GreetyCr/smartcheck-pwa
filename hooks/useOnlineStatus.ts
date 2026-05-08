"use client";

import { useState, useEffect } from "react";

/**
 * Detecta si la app está online u offline.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
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
