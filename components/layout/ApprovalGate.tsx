"use client";

import { SignOutButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { LogOut } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

/**
 * Bloquea la app para técnicos con alta pendiente de aprobación (tras sign-up).
 * Los administradores no usan este estado.
 */
export function ApprovalGate({ children }: { children: React.ReactNode }) {
  const me = useQuery(api.users.getMe, {});

  if (me === undefined) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F8F9FA] px-6">
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
        <p className="mt-4 text-sm text-muted-foreground">Cargando cuenta…</p>
      </div>
    );
  }

  if (me === null) {
    return <>{children}</>;
  }

  if (me.role !== "admin" && me.approvalStatus === "pending") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F8F9FA] px-6 text-center">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <p className="text-lg font-bold text-primary">Cuenta en revisión</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Tu registro fue recibido. Un administrador debe aprobar tu acceso
            antes de usar Smartcheck. Recibirá una notificación en el panel de
            administración.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando sea aprobado, podrás iniciar sesión con normalidad.
          </p>
          <SignOutButton>
            <Button
              type="button"
              variant="outline"
              className="mt-6 gap-2 rounded-xl"
            >
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </Button>
          </SignOutButton>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
