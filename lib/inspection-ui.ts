import type { Doc } from "@/convex/_generated/dataModel";

export type InspectionBadgeKind =
  | "borrador"
  | "completado"
  | "pendiente_sync"
  | "sincronizado";

/** Mapea documento Convex → estado de UI (badges del diseño Módulo 4.1). */
export function getInspectionUiStatus(
  inspection: Doc<"inspections">,
  options?: { pendingInSyncQueue?: boolean },
): {
  kind: InspectionBadgeKind;
  label: string;
  className: string;
} {
  const status = inspection.status ?? "draft";
  const queuePending = options?.pendingInSyncQueue ?? false;

  if (status === "synced") {
    return {
      kind: "sincronizado",
      label: "SINCRONIZADO",
      className: "bg-[#28A745]/15 text-[#1e7a34] border border-[#28A745]/40",
    };
  }

  if (status === "pending_sync" || queuePending) {
    return {
      kind: "pendiente_sync",
      label: "PENDIENTE SYNC",
      className: "bg-[#FFC107]/25 text-[#856404] border border-[#FFC107]/50",
    };
  }

  if (status === "completed") {
    return {
      kind: "completado",
      label: "COMPLETADO",
      className: "bg-[#1E3A5F]/12 text-[#1E3A5F] border border-[#1E3A5F]/35",
    };
  }

  return {
    kind: "borrador",
    label: "BORRADOR",
    className: "bg-[#FFB347]/35 text-[#8a4d00] border border-[#FFB347]/60",
  };
}

export function formatInspectionDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();

  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  const time = d.toLocaleTimeString("es-CR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) {
    return `Hoy, ${time}`;
  }
  if (isYesterday) {
    return `Ayer, ${time}`;
  }

  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  if (d.getFullYear() !== now.getFullYear()) {
    opts.year = "numeric";
  }
  return d.toLocaleString("es-CR", opts);
}
