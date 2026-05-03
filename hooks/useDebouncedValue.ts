"use client";

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = globalThis.setTimeout(() => setDebounced(value), delayMs);
    return () => globalThis.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
