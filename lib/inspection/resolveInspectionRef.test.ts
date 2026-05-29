import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { PendingInspectionRow } from "@/lib/offline/db";
import { ClientId as toClientId } from "@/lib/types/clientId";
import {
  convexIdIfSyncedLocalRow,
  resolveInspectionRef,
  type ResolveInspectionRefDeps,
} from "./resolveInspectionRef";

const UUID = "550e8400-e29b-41d4-a716-446655440004";
const LEGACY_CONVEX = "30pszp69d7c6k54554wwx9h89gycxhr";

function minimalInspectionDoc(
  overrides: Partial<Doc<"inspections">> & Pick<Doc<"inspections">, "_id">,
): Doc<"inspections"> {
  return {
    _creationTime: 1,
    status: "draft",
    findingsCount: 0,
    ...overrides,
  } as Doc<"inspections">;
}

function emptyDeps(
  overrides: Partial<ResolveInspectionRefDeps> = {},
): ResolveInspectionRefDeps {
  return {
    loadLocalRow: vi.fn().mockResolvedValue(null),
    fetchByClientId: vi.fn().mockResolvedValue(null),
    fetchByConvexId: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function minimalLocalRow(
  overrides: Partial<PendingInspectionRow>,
): PendingInspectionRow {
  const now = Date.now();
  return {
    localId: "local-1",
    data: {},
    sections: {},
    photos: [],
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
    ...overrides,
  };
}

/**
 * Cobertura alineada a review PR-E1 (seis casos):
 * 1) UUID + fila IDB → local_only
 * 2) UUID sin IDB + Convex → convex (invariante otro dispositivo)
 * 3) UUID sin IDB + sin Convex → not_found
 * 4) Id legacy Convex → convex vía get
 * 5) String sin forma UUID ni legacy → not_found
 * 6) Whitespace → trim antes de IDB/Convex
 */
describe("convexIdIfSyncedLocalRow", () => {
  it("returns null while row is not fully synced", () => {
    const row = minimalLocalRow({
      convexId: LEGACY_CONVEX,
      syncStatus: "syncing",
    });
    expect(convexIdIfSyncedLocalRow(row)).toBeNull();
  });

  it("returns convex id only when syncStatus is synced", () => {
    const row = minimalLocalRow({
      convexId: LEGACY_CONVEX,
      syncStatus: "synced",
    });
    expect(convexIdIfSyncedLocalRow(row)).toBe(LEGACY_CONVEX);
  });
});

describe("resolveInspectionRef", () => {
  it("falls through to Convex when UUID v4 not in local IDB", async () => {
    const doc = minimalInspectionDoc({
      _id: LEGACY_CONVEX as Id<"inspections">,
      clientId: UUID,
    });
    const deps = emptyDeps({
      loadLocalRow: vi.fn().mockResolvedValue(null),
      fetchByClientId: vi.fn().mockResolvedValue(doc),
    });
    const out = await resolveInspectionRef(UUID, deps);
    expect(out).toEqual({
      kind: "convex",
      clientId: UUID,
      convexId: doc._id,
    });
    expect(deps.fetchByClientId).toHaveBeenCalledWith(UUID);
    expect(deps.fetchByConvexId).not.toHaveBeenCalled();
  });

  it("resolves legacy Id<inspections> via Convex get", async () => {
    const doc = minimalInspectionDoc({
      _id: LEGACY_CONVEX as Id<"inspections">,
      clientId: UUID,
    });
    const deps = emptyDeps({
      fetchByConvexId: vi.fn().mockResolvedValue(doc),
    });
    const out = await resolveInspectionRef(LEGACY_CONVEX, deps);
    expect(out.kind).toBe("convex");
    if (out.kind === "convex") {
      expect(out.clientId).toBe(UUID);
      expect(out.convexId).toBe(doc._id);
    }
    expect(deps.fetchByConvexId).toHaveBeenCalledWith(
      LEGACY_CONVEX as Id<"inspections">,
    );
    expect(deps.fetchByClientId).not.toHaveBeenCalled();
  });

  it("returns local_only when UUID v4 matches a row in IDB", async () => {
    const row = minimalLocalRow({
      localId: UUID,
      clientId: toClientId(UUID),
    });
    const deps = emptyDeps({
      loadLocalRow: vi.fn().mockResolvedValue(row),
    });
    const out = await resolveInspectionRef(UUID, deps);
    expect(out).toEqual({ kind: "local_only", row });
    expect(deps.fetchByClientId).not.toHaveBeenCalled();
  });

  it("returns not_found when UUID v4 has no IDB row and Convex returns null", async () => {
    const deps = emptyDeps({
      loadLocalRow: vi.fn().mockResolvedValue(null),
      fetchByClientId: vi.fn().mockResolvedValue(null),
    });
    const out = await resolveInspectionRef(UUID, deps);
    expect(out).toEqual({ kind: "not_found" });
  });

  it("returns not_found when ref is neither UUID v4 nor legacy Convex id shape", async () => {
    const deps = emptyDeps();
    const out = await resolveInspectionRef("not-a-valid-ref", deps);
    expect(out).toEqual({ kind: "not_found" });
    expect(deps.fetchByClientId).not.toHaveBeenCalled();
    expect(deps.fetchByConvexId).not.toHaveBeenCalled();
  });

  it("trims whitespace before classifying and querying", async () => {
    const doc = minimalInspectionDoc({
      _id: LEGACY_CONVEX as Id<"inspections">,
      clientId: UUID,
    });
    const loadLocalRow = vi.fn().mockResolvedValue(null);
    const fetchByClientId = vi.fn().mockResolvedValue(doc);
    const deps = emptyDeps({ loadLocalRow, fetchByClientId });
    const out = await resolveInspectionRef(`  ${UUID}  `, deps);
    expect(loadLocalRow).toHaveBeenCalledWith(UUID);
    expect(fetchByClientId).toHaveBeenCalledWith(UUID);
    expect(out).toEqual({
      kind: "convex",
      clientId: UUID,
      convexId: doc._id,
    });
  });

  it("returns not_found for legacy-shaped id when Convex returns null", async () => {
    const deps = emptyDeps({
      fetchByConvexId: vi.fn().mockResolvedValue(null),
    });
    const out = await resolveInspectionRef(LEGACY_CONVEX, deps);
    expect(out).toEqual({ kind: "not_found" });
  });

  it("resolves legacy Convex id when document has no clientId (pre-backfill)", async () => {
    const doc = minimalInspectionDoc({
      _id: LEGACY_CONVEX as Id<"inspections">,
      clientId: undefined,
    });
    const deps = emptyDeps({
      fetchByConvexId: vi.fn().mockResolvedValue(doc),
    });
    const out = await resolveInspectionRef(LEGACY_CONVEX, deps);
    expect(out).toEqual({
      kind: "convex",
      clientId: LEGACY_CONVEX,
      convexId: doc._id,
    });
  });

  it("returns not_found for empty / whitespace-only ref", async () => {
    const deps = emptyDeps();
    expect(await resolveInspectionRef("", deps)).toEqual({
      kind: "not_found",
    });
    expect(await resolveInspectionRef("   ", deps)).toEqual({
      kind: "not_found",
    });
    expect(deps.loadLocalRow).not.toHaveBeenCalled();
  });
});
