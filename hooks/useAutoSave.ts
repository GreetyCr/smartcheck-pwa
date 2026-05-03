"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Auto-guardado con debounce (RF-18).
 * @param delay retardo en ms (default 1000).
 */
export function useAutoSave<T>(
  data: T,
  saveFunction: (data: T) => Promise<void>,
  delay = 1000,
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveRef = useRef(saveFunction);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveRef.current = saveFunction;
  }, [saveFunction]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      void (async () => {
        setIsSaving(true);
        try {
          await saveRef.current(data);
          setLastSaved(new Date());
        } catch (e) {
          console.error("Auto-save failed:", e);
        } finally {
          setIsSaving(false);
        }
      })();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [data, delay]);

  return { isSaving, lastSaved };
}
