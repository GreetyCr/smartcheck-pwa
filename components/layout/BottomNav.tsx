"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloudUpload, Home, List, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/historial", label: "Historial", Icon: List },
  { href: "/sincronizar", label: "Sincronizar", Icon: CloudUpload },
  { href: "/perfil", label: "Perfil", Icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_24px_rgba(30,58,95,0.08)]"
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 pt-2">
        {tabs.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/" || pathname === ""
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition-colors sm:text-xs",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-6 shrink-0",
                  active ? "stroke-[2.5]" : "stroke-[2]",
                )}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
