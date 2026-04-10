"use client";

import Link from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { LayoutDashboard, LogOut, Mail, Shield } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { APP_VERSION } from "@/lib/app-meta";
import { Button } from "@/components/ui/button";

export default function PerfilPage() {
  const { user, isLoaded } = useUser();
  const me = useQuery(api.users.getMe, isLoaded ? {} : "skip");

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-6 pt-4 text-sm text-muted-foreground">
        Cargando perfil…
      </div>
    );
  }

  const name =
    user?.fullName ?? user?.firstName ?? user?.username ?? "Usuario";
  const email = user?.primaryEmailAddress?.emailAddress ?? "—";
  const imageUrl = user?.imageUrl;
  const roleLabel = me?.role === "admin" ? "Administrador" : "Técnico";

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-primary">Perfil</h1>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="relative size-24 overflow-hidden rounded-full border-2 border-primary/20 bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              width={96}
              height={96}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{name}</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-4 shrink-0" aria-hidden />
            {email}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Shield className="size-3.5" aria-hidden />
            Rol: {roleLabel}
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm shadow-sm">
        <div className="flex justify-between gap-2 border-b border-border pb-2">
          <span className="text-muted-foreground">Versión de la app</span>
          <span className="font-mono font-medium">{APP_VERSION}</span>
        </div>
        {me?.role === "admin" ? (
          <Link
            href="/admin"
            className="flex items-center justify-between rounded-xl bg-[#1E3A5F] px-3 py-2.5 font-semibold text-white transition-colors hover:bg-[#1E3A5F]/90"
          >
            <span className="flex items-center gap-2">
              <LayoutDashboard className="size-4" aria-hidden />
              Panel de administración
            </span>
            <span className="text-white/80">→</span>
          </Link>
        ) : null}
        <Link
          href="mailto:?subject=Soporte%20Smartcheck"
          className="flex items-center justify-between py-2 text-primary hover:underline"
        >
          Contactar soporte
          <span className="text-muted-foreground">→</span>
        </Link>
      </div>

      <SignOutButton>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </SignOutButton>

      <p className="text-center text-[11px] text-muted-foreground">
        Cuenta gestionada con Clerk. Ajustes avanzados en el panel web.
      </p>
    </div>
  );
}
