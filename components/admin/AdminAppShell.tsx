"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AdminMobileHeader, AdminSidebar } from "@/components/admin/AdminSidebar";

export function AdminAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useQuery(api.users.getMe, {});
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (me === null || (me !== undefined && me.role !== "admin")) {
      router.replace("/");
    }
  }, [me, router]);

  if (me === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F8F9FA] text-sm text-muted-foreground">
        Verificando permisos…
      </div>
    );
  }

  if (me === null || me.role !== "admin") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F8F9FA] text-sm text-muted-foreground">
        Redirigiendo…
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-[#F8F9FA]">
      <AdminSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
