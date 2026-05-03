"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
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

export function TechnicianRow({
  user,
  inspectionCount,
  lastActivityAt,
}: TechnicianRowProps) {
  const [busy, setBusy] = useState(false);
  const promote = useMutation(api.users.promoteToAdmin);
  const demote = useMutation(api.users.demoteToTechnician);
  const approve = useMutation(api.users.approveTechnician);

  const isAdmin = user.role === "admin";
  const isPendingApproval =
    user.role !== "admin" && user.approvalStatus === "pending";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-b border-border/80 bg-white text-sm last:border-0">
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
              {(user.name ?? user.email).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground">
              {user.name?.trim() || "Sin nombre"}
            </p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              isAdmin
                ? "bg-[#1E3A5F]/10 text-[#1E3A5F]"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isAdmin ? "Administrador" : "Técnico"}
          </span>
          {isPendingApproval ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
              Pendiente de aprobación
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-3 tabular-nums text-muted-foreground">
        {inspectionCount}
      </td>
      <td className="hidden px-3 py-3 text-muted-foreground lg:table-cell">
        {formatWhen(lastActivityAt)}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          {isPendingApproval ? (
            <Button
              type="button"
              size="sm"
              className="rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-600/90"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await approve({ userId: user._id });
                })
              }
            >
              Aprobar acceso
            </Button>
          ) : null}
          {isAdmin ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await demote({ userId: user._id });
                })
              }
            >
              Quitar admin
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="rounded-lg bg-[#FF8C00] text-xs font-semibold text-white hover:bg-[#FF8C00]/90"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await promote({ userId: user._id });
                })
              }
            >
              Hacer admin
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
