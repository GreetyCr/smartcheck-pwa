import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePendingInspectionDraft } from "@/hooks/usePendingInspectionDraft";
import { getDB, resetOfflineDbForTests } from "@/lib/offline/db";
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
});
