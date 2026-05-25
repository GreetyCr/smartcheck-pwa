import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Smartphone,
  UploadCloud,
} from "lucide-react";
import type { PendingInspectionRow } from "@/lib/offline/db";
import { cn } from "@/lib/utils";

export type SyncStatusBadgeProps = {
  status: PendingInspectionRow["syncStatus"];
  className?: string;
};

const STATUS_CONFIG: Record<
  PendingInspectionRow["syncStatus"],
  { label: string; icon: typeof Smartphone; className: string; spin?: boolean }
> = {
  pending: {
    label: "En el dispositivo",
    icon: Smartphone,
    className: "bg-secondary text-secondary-foreground",
  },
  uploading: {
    label: "Subiendo fotos",
    icon: UploadCloud,
    className: "bg-primary/10 text-primary",
  },
  syncing: {
    label: "Sincronizando",
    icon: RefreshCw,
    className: "bg-primary/10 text-primary",
    spin: true,
  },
  synced: {
    label: "Sincronizado",
    icon: CheckCircle,
    className: "bg-emerald-500/15 text-emerald-700",
  },
  error: {
    label: "Error de sincronización",
    icon: AlertTriangle,
    className: "bg-destructive/10 text-destructive",
  },
};

/** Badge para `PendingInspectionRow.syncStatus` (cola IDB). No confundir con `getInspectionUiStatus`. */
export function SyncStatusBadge({ status, className }: SyncStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        cfg.className,
        className,
      )}
    >
      <Icon
        className={cn("size-3.5 shrink-0", cfg.spin && "animate-spin")}
        aria-hidden
      />
      {cfg.label}
    </span>
  );
}
