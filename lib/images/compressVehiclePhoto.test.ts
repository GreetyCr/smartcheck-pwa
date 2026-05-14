import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compressVehiclePhoto,
  computeScaledDimensions,
  VEHICLE_PHOTO_MAX_EDGE,
  VEHICLE_PHOTO_OUTPUT_MIME,
} from "./compressVehiclePhoto";

describe("computeScaledDimensions", () => {
  it("no reescala si el lado mayor ya cabe en maxEdge", () => {
    expect(computeScaledDimensions(800, 600, 1600)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("reduce el lado mayor a maxEdge manteniendo proporción", () => {
    expect(computeScaledDimensions(3200, 1600, 1600)).toEqual({
      width: 1600,
      height: 800,
    });
  });
});

describe("compressVehiclePhoto", () => {
  let bitmapClose: ReturnType<typeof vi.fn>;
  const prevDocument = globalThis.document;
  const prevCreateImageBitmap = globalThis.createImageBitmap;

  beforeEach(() => {
    bitmapClose = vi.fn();
    globalThis.createImageBitmap = vi.fn(async () => ({
      width: 2400,
      height: 1200,
      close: bitmapClose,
    })) as typeof createImageBitmap;

    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 0, 0]);
    const mockBlob = new Blob([jpegBytes], { type: VEHICLE_PHOTO_OUTPUT_MIME });
    const canvasStub = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        drawImage: vi.fn(),
      })),
      toBlob: (
        cb: (blob: Blob | null) => void,
        _type?: string,
        _quality?: number,
      ) => {
        cb(mockBlob);
      },
    };

    globalThis.document = {
      createElement: (tag: string) => {
        if (tag === "canvas") return canvasStub as unknown as HTMLCanvasElement;
        throw new Error(`unexpected createElement(${tag})`);
      },
    } as unknown as Document;
  });

  afterEach(() => {
    globalThis.document = prevDocument;
    globalThis.createImageBitmap = prevCreateImageBitmap;
  });

  it("devuelve File JPEG, lado mayor ≤ maxEdge, y bytes === size", async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], "captura.PNG", {
      type: "image/png",
    });
    const r = await compressVehiclePhoto(file);

    expect(r.file.type).toBe(VEHICLE_PHOTO_OUTPUT_MIME);
    expect(r.file.name.toLowerCase().endsWith(".jpg")).toBe(true);
    expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(VEHICLE_PHOTO_MAX_EDGE);
    expect(r.bytes).toBe(r.file.size);
    expect(bitmapClose).toHaveBeenCalled();
  });
});
