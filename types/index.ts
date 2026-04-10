/**
 * Tipos globales de la app.
 */

export type InspectionStatus = "draft" | "pending_sync" | "synced" | "published";

export interface Inspection {
  id: string;
  clientName?: string;
  vehiclePlate?: string;
  status: InspectionStatus;
  createdAt: string;
  updatedAt: string;
}
