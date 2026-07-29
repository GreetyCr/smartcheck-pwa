"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignOutButton } from "@clerk/nextjs";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BarChart3,
  Car,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav: {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
}[] = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/admin/finanzas", label: "Finanzas", Icon: BarChart3 },
  { href: "/admin/inspecciones", label: "Inspecciones", Icon: Car },
  { href: "/admin/tecnicos", label: "Técnicos", Icon: Users },
  { href: "/admin/configuracion", label: "Configuración", Icon: Settings },
];

type AdminSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const pendingApprovals = useQuery(api.users.pendingApprovalCount, {});

  const linkClass = (href: string, exact?: boolean) => {
    const active = exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
    return cn(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      active
        ? "bg-white/10 text-white"
        : "text-white/75 hover:bg-white/5 hover:text-white",
    );
  };

  const NavBody = (
    <>
      <div className="border-b border-white/10 px-4 py-5">
        <div className="flex items-center gap-2 text-white">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#FF8C00] text-lg">
            🚗
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">SMARTCHECK</p>
            <p className="text-[11px] font-medium text-white/60">Panel Admin</p>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map(({ href, label, Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={linkClass(href, exact)}
            onClick={() => onClose()}
          >
            <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
            <span className="flex flex-1 items-center justify-between gap-2">
              {label}
              {href === "/admin/tecnicos" &&
              (pendingApprovals ?? 0) > 0 ? (
                <span className="rounded-full bg-[#FF8C00] px-2 py-0.5 text-[10px] font-bold text-white">
                  {pendingApprovals}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link
          href="/"
          className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/5"
          onClick={() => onClose()}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la app
        </Link>
        <SignOutButton>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/75 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-4" aria-hidden />
            Cerrar sesión
          </button>
        </SignOutButton>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col bg-[#1E3A5F] text-white md:flex md:min-h-screen md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        {NavBody}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar menú"
            onClick={onClose}
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(18rem,100%)] flex-col bg-[#1E3A5F] shadow-xl">
            <div className="flex items-center justify-end border-b border-white/10 p-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={onClose}
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </Button>
            </div>
            {NavBody}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AdminMobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-[#1E3A5F] px-3 py-3 text-white md:hidden">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-white hover:bg-white/10"
        onClick={onMenuClick}
        aria-label="Abrir menú"
      >
        <Menu className="size-5" />
      </Button>
      <div className="flex items-center gap-2">
        <BarChart3 className="size-5 text-[#FF8C00]" aria-hidden />
        <span className="text-sm font-bold">Admin</span>
      </div>
    </header>
  );
}
