"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Clock, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatInt } from "@/lib/bi-format";
import { cn } from "@/lib/utils";

type TechnicianRowProps = {
  user: Doc<"users">;
  inspectionCount: number;
  lastActivityAt: number | null;
};

function formatWhen(ts: number | null): string {
  if (ts === null) return "Sin actividad";
  return new Date(ts).toLocaleString("es-CR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Acción de fila: 44px de alto y foco visible sobre el grafito. */
const ACTION_BASE =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-[filter,background-color,transform] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bi-surface)] active:scale-[0.98] disabled:opacity-50";

export function TechnicianRow({
  user,
  inspectionCount,
  lastActivityAt,
}: TechnicianRowProps) {
  const [busy, setBusy] = useState(false);
  const promote = useMutation(api.users.promoteToAdmin);
  const demote = useMutation(api.users.demoteToTechnician);
  const approve = useMutation(api.users.approveTechnician);

  const [error, setError] = useState<string | null>(null);
  const isAdmin = user.role === "admin";
  const isPendingApproval =
    user.role !== "admin" && user.approvalStatus === "pending";

  /**
   * **El error se muestra, no solo se loguea — A146.**
   *
   * Iba únicamente a `console.error`, así que un rechazo legítimo del servidor
   * —«Debe existir al menos un administrador»— **no llegaba nunca a la
   * pantalla**: el botón se apagaba, volvía a encenderse y no pasaba nada. Un
   * usuario que ve eso concluye que la pantalla está rota, cuando el sistema lo
   * estaba protegiendo de quedarse sin admin y tenía una buena razón que decir.
   */
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-b border-[var(--bi-ring)]/60 text-sm transition-colors last:border-0 hover:bg-[var(--bi-surface-2)]">
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--bi-plane)] text-sm font-bold text-[var(--bi-ink-3)]"
            >
              {(user.name ?? user.email).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--bi-ink)]">
              {user.name?.trim() || "Sin nombre"}
            </p>
            <p className="truncate text-xs text-[var(--bi-ink-3)]">
              {user.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* El rol lleva icono + rótulo: nunca se comunica solo por color. */}
          <span
            className={cn(
              "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              isAdmin
                ? "border-[var(--bi-income)]/45 text-[var(--bi-income)]"
                : "border-[var(--bi-ring)] text-[var(--bi-ink-2)]",
            )}
          >
            {isAdmin ? (
              <ShieldCheck className="size-3" aria-hidden />
            ) : (
              <UserRound className="size-3" aria-hidden />
            )}
            {isAdmin ? "Administrador" : "Técnico"}
          </span>
          {isPendingApproval ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--bi-warn)]/50 px-2 py-0.5 text-[11px] font-semibold text-[var(--bi-warn)]">
              <Clock className="size-3" aria-hidden />
              Pendiente de aprobación
            </span>
          ) : null}
        </div>
      </td>
      <td className="bi-num px-3 py-3 text-[var(--bi-ink)]">
        {formatInt(inspectionCount)}
      </td>
      <td className="hidden whitespace-nowrap px-3 py-3 text-[var(--bi-ink-3)] lg:table-cell">
        {formatWhen(lastActivityAt)}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          {isPendingApproval ? (
            <button
              type="button"
              className={cn(
                ACTION_BASE,
                "bg-[var(--bi-good)] text-[#06220f] hover:brightness-110 focus-visible:ring-[var(--bi-good)]",
              )}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await approve({ userId: user._id });
                })
              }
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Aprobar acceso
            </button>
          ) : null}
          {isAdmin ? (
            <button
              type="button"
              className={cn(
                ACTION_BASE,
                "border border-[var(--bi-ring)] font-medium text-[var(--bi-ink-2)] hover:bg-[var(--bi-plane)] hover:text-[var(--bi-ink)] focus-visible:ring-[var(--bi-income)]",
              )}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await demote({ userId: user._id });
                })
              }
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Quitar admin
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                ACTION_BASE,
                "bg-[var(--bi-income)] text-[#06222a] hover:brightness-110 focus-visible:ring-[var(--bi-income)]",
              )}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await promote({ userId: user._id });
                })
              }
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Hacer admin
            </button>
          )}
        </div>
        {error ? (
          <p
            role="alert"
            className="mt-2 text-[12px] leading-snug text-[var(--bi-expense)]"
          >
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
