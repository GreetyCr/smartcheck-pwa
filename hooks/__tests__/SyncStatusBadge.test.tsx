import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SyncStatusBadge } from "@/components/inspection/SyncStatusBadge";
import type { PendingInspectionRow } from "@/lib/offline/db";

const STATUSES: PendingInspectionRow["syncStatus"][] = [
  "pending",
  "uploading",
  "syncing",
  "synced",
  "error",
];

const LABELS: Record<PendingInspectionRow["syncStatus"], string> = {
  pending: "En el dispositivo",
  uploading: "Subiendo fotos",
  syncing: "Sincronizando",
  synced: "Sincronizado",
  error: "Error de sincronización",
};

describe("SyncStatusBadge", () => {
  test.each(STATUSES)("renderiza estado %s", (status) => {
    render(<SyncStatusBadge status={status} />);
    expect(screen.getByText(LABELS[status])).toBeTruthy();
  });
});
