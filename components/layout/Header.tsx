"use client";

import { Bell } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

type HeaderProps = {
  /** Notificaciones no leídas (placeholder hasta integrar notificaciones reales) */
  unreadNotifications?: number;
};

function buildGreeting(
  convexName: string | undefined,
  clerkFirst: string | null | undefined,
  clerkLast: string | null | undefined,
  clerkFull: string | null | undefined,
): string {
  const raw =
    convexName?.trim() ||
    clerkFull?.trim() ||
    [clerkFirst, clerkLast].filter(Boolean).join(" ").trim() ||
    "";

  if (!raw) return "Usuario";

  const parts = raw.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "Usuario";
  if (parts.length === 1) return firstName;

  const lastWord = parts[parts.length - 1]!;
  return `${firstName} ${lastWord[0]!.toUpperCase()}.`;
}

export function Header({ unreadNotifications = 1 }: HeaderProps) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const convexUser = useQuery(api.users.getMe);

  const greeting = buildGreeting(
    convexUser?.name,
    clerkUser?.firstName,
    clerkUser?.lastName,
    clerkUser?.fullName,
  );

  const imageUrl =
    convexUser?.imageUrl || clerkUser?.imageUrl || null;

  const showBadge = unreadNotifications > 0;

  if (!clerkLoaded) {
    return (
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-4">
        <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </div>
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={cn(
            "relative size-12 shrink-0 overflow-hidden rounded-full border-2 border-primary/20 bg-muted",
          )}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URLs dinámicas Clerk sin remotePatterns
            <img
              src={imageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-primary/10 text-sm font-semibold text-primary">
              {greeting.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bienvenido de nuevo
          </p>
          <p className="truncate text-lg font-bold text-primary">
            Hola, {greeting}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="relative shrink-0 rounded-full p-2 text-primary transition-colors hover:bg-muted"
        aria-label="Notificaciones"
      >
        <Bell className="size-6" strokeWidth={2} />
        {showBadge && (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-[#DC3545] ring-2 ring-card" />
        )}
      </button>
    </header>
  );
}
