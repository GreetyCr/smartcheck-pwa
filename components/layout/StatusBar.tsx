"use client";

import { Cloud, CloudOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const online = useOnlineStatus();

  return (
    <div
      className={cn(
        "sticky top-0 z-40 flex w-full items-center justify-center gap-2 px-4 py-2.5 text-center text-xs font-medium text-white sm:text-sm",
        online ? "bg-[#28A745]" : "bg-[#6c757d]",
      )}
      role="status"
      aria-live="polite"
    >
      {online ? (
        <>
          <Cloud className="size-4 shrink-0" aria-hidden />
          <span>MODO EN LÍNEA: Sincronización activa</span>
        </>
      ) : (
        <>
          <CloudOff className="size-4 shrink-0" aria-hidden />
          <span>MODO OFFLINE</span>
        </>
      )}
    </div>
  );
}
