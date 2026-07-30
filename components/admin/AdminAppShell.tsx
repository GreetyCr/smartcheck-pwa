"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AdminMobileHeader, AdminSidebar } from "@/components/admin/AdminSidebar";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Shell del panel admin. Es el **dueño del tema**: aplica `.bi-graphite` y el
 * plano oscuro a toda el área, así que los tableros de dentro solo maquetan su
 * contenido (antes Finanzas pintaba su propio fondo y cancelaba el padding del
 * `main` con márgenes negativos).
 */
export function AdminAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useQuery(api.users.getMe, {});

  useEffect(() => {
    if (me === null || (me !== undefined && me.role !== "admin")) {
      router.replace("/");
    }
  }, [me, router]);

  if (me === undefined) {
    return <ShellNotice>Verificando permisos…</ShellNotice>;
  }

  if (me === null || me.role !== "admin") {
    return <ShellNotice>Redirigiendo…</ShellNotice>;
  }

  return <AdminShellChrome>{children}</AdminShellChrome>;
}

function ShellNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        ADMIN_THEME_CLASS,
        "flex min-h-dvh items-center justify-center text-sm text-[var(--bi-ink-2)]",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Cromo del panel (sidebar + barra móvil + contenido).
 *
 * El contador de aprobaciones se pide **acá** y no dentro del sidebar:
 * `pendingApprovalCount` exige rol admin en Convex, y este componente solo se
 * monta con el rol ya confirmado. Así el sidebar queda presentacional y se
 * puede renderizar en las vistas de revisión de `app/dev/*` sin sesión.
 */
function AdminShellChrome({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingApprovals = useQuery(api.users.pendingApprovalCount, {});

  return (
    <div className={cn(ADMIN_THEME_CLASS, "flex min-h-dvh")}>
      <AdminSidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pendingApprovals={pendingApprovals ?? 0}
      />
      {/* `min-w-0` es lo que impide que una tabla ancha estire el flex y saque
          scroll horizontal al body: la tabla scrollea en su propio contenedor. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader
          onMenuClick={() => setMenuOpen(true)}
          pendingApprovals={pendingApprovals ?? 0}
        />
        <main className={cn("min-w-0 flex-1", ADMIN_CONTENT_PADDING)}>
          {children}
        </main>
      </div>
    </div>
  );
}
