"use client";

import { useCallback, useRef, useState } from "react";
import { getScrollY } from "@/lib/browser-confirm";
import { cn } from "@/lib/utils";

type PullToRefreshProps = {
  children: React.ReactNode;
  onRefresh: () => void | Promise<void>;
  className?: string;
};

/**
 * Pull-to-refresh ligero para móvil (scroll en y=0).
 */
export function PullToRefresh({
  children,
  onRefresh,
  className,
}: PullToRefreshProps) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);

  const threshold = 64;

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
      setOffset(0);
    }
  }, [busy, onRefresh]);

  return (
    <div
      className={cn("relative", className)}
      onTouchStart={(e) => {
        const y = e.touches[0]?.clientY ?? 0;
        if (getScrollY() <= 0) {
          pulling.current = true;
          startY.current = y;
        }
      }}
      onTouchMove={(e) => {
        if (!pulling.current || busy) return;
        const y = e.touches[0]?.clientY ?? 0;
        const dy = y - startY.current;
        if (dy > 0 && getScrollY() <= 0) {
          setOffset(Math.min(dy * 0.45, threshold + 20));
        }
      }}
      onTouchEnd={() => {
        pulling.current = false;
        if (offset >= threshold && !busy) {
          void run();
        } else {
          setOffset(0);
        }
      }}
    >
      <div
        className="pointer-events-none flex justify-center overflow-hidden text-xs font-medium text-primary transition-[height,opacity]"
        style={{
          height: offset > 4 ? Math.min(offset, 48) : 0,
          opacity: offset > 8 ? 1 : 0,
        }}
        aria-live="polite"
      >
        {busy ? "Actualizando…" : "Soltar para actualizar"}
      </div>
      {children}
    </div>
  );
}
