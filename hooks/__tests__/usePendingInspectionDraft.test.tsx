import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePendingInspectionDraft } from "@/hooks/usePendingInspectionDraft";
import { getDB } from "@/lib/offline/db";
import { resetOfflineDbForTests } from "@/lib/offline/db.testing";
import { ClientId as toClientId } from "@/lib/types/clientId";

const testClientId = () =>
  toClientId("eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee");

describe("usePendingInspectionDraft", () => {
  beforeEach(async () => {
    await resetOfflineDbForTests();
  });
  afterEach(async () => {
    vi.useRealTimers();
    await resetOfflineDbForTests();
  });

  test("flush() escribe de inmediato en IDB (sin esperar debounce)", async () => {
    const cid = testClientId();
    const { result } = renderHook(() =>
      usePendingInspectionDraft({ localId: cid }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.save({ data: { k: "v" } });
    });
    await act(async () => {
      await result.current.flush();
    });
    const db = await getDB();
    const row = await db.get("pendingInspections", cid as string);
    expect((row?.data as { k?: string }).k).toBe("v");
  });

  test("debounce: coalescer — último save gana tras el intervalo", async () => {
    const cid = testClientId();
    const { result } = renderHook(() =>
      usePendingInspectionDraft({ localId: cid, debounceMs: 300 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.useFakeTimers();
    act(() => {
      result.current.save({ data: { n: 1 } });
    });
    act(() => {
      result.current.save({ data: { n: 2 } });
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();
    const db = await getDB();
    const row = await db.get("pendingInspections", cid as string);
    expect((row?.data as { n?: number }).n).toBe(2);
  });

  test("pagehide con persisted false dispara put (sin await en handler)", async () => {
    const cid = testClientId();
    const { result } = renderHook(() =>
      usePendingInspectionDraft({ localId: cid }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.save({ data: { page: true } });
    });
    const ev = new PageTransitionEvent("pagehide", { persisted: false });
    act(() => {
      globalThis.dispatchEvent(ev);
    });
    await waitFor(async () => {
      const db = await getDB();
      const row = await db.get("pendingInspections", cid as string);
      expect((row?.data as { page?: boolean }).page).toBe(true);
    });
  });

  test("coalescer: data {a:1} luego {b:2} luego {a:3} → { a:3, b:2 }", async () => {
    const cid = toClientId("ffffffff-ffff-4fff-ffff-ffffffffffff");
    const { result } = renderHook(() =>
      usePendingInspectionDraft({ localId: cid, debounceMs: 400 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.useFakeTimers();
    act(() => {
      result.current.save({ data: { a: 1 } });
    });
    act(() => {
      result.current.save({ data: { b: 2 } });
    });
    act(() => {
      result.current.save({ data: { a: 3 } });
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();
    const db = await getDB();
    const row = await db.get("pendingInspections", cid as string);
    const d = row?.data as { a?: number; b?: number };
    expect(d?.a).toBe(3);
    expect(d?.b).toBe(2);
  });

  test("unmount con save pendiente hace flush (navegación SPA sin pagehide)", async () => {
    const cid = toClientId("11111111-1111-4111-8111-111111111111");
    const { result, unmount } = renderHook(() =>
      usePendingInspectionDraft({ localId: cid, debounceMs: 60_000 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.save({ data: { spa: 42 } });
    });
    unmount();
    await waitFor(async () => {
      const db = await getDB();
      const row = await db.get("pendingInspections", cid as string);
      expect((row?.data as { spa?: number }).spa).toBe(42);
    });
  });
});
