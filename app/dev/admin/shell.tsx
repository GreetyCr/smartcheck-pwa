"use client";

import { useState } from "react";
import {
  AdminMobileHeader,
  AdminSidebar,
} from "@/components/admin/AdminSidebar";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/** Técnicos pendientes de aprobación: para revisar el badge del menú. */
const PENDING_APPROVALS = 2;

/**
 * Réplica de `AdminShellChrome` para las vistas de revisión: mismo tema, mismo
 * cromo, misma maqueta. Lo único que cambia es que los datos son de muestra y
 * que la ruta activa se fuerza (la URL real es `/dev/...`, no `/admin/...`).
 *
 * El aviso va DENTRO del `main` a propósito: el sidebar es `sticky h-dvh`, así
 * que cualquier banda por encima del shell lo desplazaría y le cortaría el pie.
 */
export function DevAdminShell({
  activePath,
  children,
}: {
  activePath: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={cn(ADMIN_THEME_CLASS, "flex min-h-dvh")}>
      <AdminSidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pendingApprovals={PENDING_APPROVALS}
        activePath={activePath}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader
          onMenuClick={() => setMenuOpen(true)}
          pendingApprovals={PENDING_APPROVALS}
        />
        <main className={cn("min-w-0 flex-1", ADMIN_CONTENT_PADDING)}>
          <p
            role="note"
            className="mb-4 rounded-xl border border-[var(--bi-warn)]/40 bg-[var(--bi-warn)]/10 px-3 py-2 text-[13px] text-[var(--bi-warn)]"
          >
            <strong>Vista de revisión visual</strong> — datos de muestra, sin
            sesión. No existe en producción.
          </p>
          {children}
        </main>
      </div>
    </div>
  );
}
