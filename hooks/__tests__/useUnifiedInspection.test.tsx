import "fake-indexeddb/auto";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useUnifiedInspection } from "@/hooks/useUnifiedInspection";
import { resetOfflineDbForTests } from "@/lib/offline/db";

const UUID = "550e8400-e29b-41d4-a716-446655440004";
const LEGACY = "30pszp69d7c6k54554wwx9h89gycxhr";

const { mockQuery, convexClientStub } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  /** Misma referencia en cada render (evita bucle infinito en `useMemo([convex])`). */
  const convexClientStub = { query: mockQuery };
  return { mockQuery, convexClientStub };
});

vi.mock("convex/react", () => ({
  useConvex: () => convexClientStub,
}));

describe("useUnifiedInspection", () => {
  beforeEach(async () => {
    await resetOfflineDbForTests();
    mockQuery.mockReset();
    mockQuery.mockImplementation(
      async (_fn: unknown, args: { id?: string; clientId?: string }) => {
        if (args.clientId === UUID) {
          return {
            _id: LEGACY,
            _creationTime: 1,
            clientId: UUID,
            status: "draft",
            findingsCount: 0,
          };
        }
        if (args.id === LEGACY) {
          return {
            _id: LEGACY,
            _creationTime: 1,
            clientId: UUID,
            status: "draft",
            findingsCount: 0,
          };
        }
        return null;
      },
    );
  });

  afterEach(async () => {
    await resetOfflineDbForTests();
  });

  test("status ready con resolution.kind convex y convexId presente", async () => {
    const { result } = renderHook(() => useUnifiedInspection(UUID));
    await waitFor(() =>
      expect(result.current.state.status).toBe("ready"),
    );
    expect(result.current.state.status).toBe("ready");
    if (result.current.state.status === "ready") {
      expect(result.current.state.resolution.kind).toBe("convex");
      const r = result.current.state.resolution;
      if (r.kind === "convex") {
        expect(r.convexId).toBe(LEGACY);
        expect(r.clientId).toBe(UUID);
      }
    }
    expect(result.current.clientId).toBe(UUID);
    expect(result.current.convexId).toBe(LEGACY);
    expect(result.current.syncStatus).toBe("synced");
  });

  test("ref vacío → idle sin llamar a Convex", async () => {
    const { result } = renderHook(() => useUnifiedInspection(undefined));
    await waitFor(() => expect(result.current.state.status).toBe("idle"));
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
