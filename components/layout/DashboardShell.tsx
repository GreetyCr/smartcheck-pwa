"use client";

import { usePathname } from "next/navigation";
import { StatusBar } from "@/components/layout/StatusBar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wizardMode = pathname.startsWith("/inspecciones/nueva");
  /** Inspección en curso (lista de secciones, detalle, etc.) — mismo criterio que wizard: sin header/nav global. */
  const inspectionFlowMode =
    pathname.startsWith("/inspecciones/") && !pathname.startsWith("/inspecciones/nueva");
  const chromeHidden = wizardMode || inspectionFlowMode;

  return (
    <div className="flex min-h-dvh flex-col bg-[#F8F9FA]">
      <StatusBar />
      {!chromeHidden && <Header />}
      <main
        className={cn(
          "flex-1 overflow-y-auto",
          chromeHidden
            ? "pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
            : "pb-[calc(5rem+env(safe-area-inset-bottom,0px))]",
        )}
      >
        {children}
      </main>
      {!chromeHidden && <BottomNav />}
    </div>
  );
}
