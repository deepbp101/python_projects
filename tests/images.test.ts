import { describe, expect, it } from "vitest";
import { extensionFor, inspectImage } from "@/lib/storage/images";

/**
 * Format detection is a security control, not a convenience: the browser's
 * declared MIME type is discarded and only these bytes decide what a file is.
 */

function pngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13], 8); // IHDR length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function gifBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // "GIF89a"
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return bytes;
}

function jpegBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0xff, 0xd8], 0); // SOI
  bytes.set([0xff, 0xc0], 2); // SOF0
  const view = new DataView(bytes.buffer);
  view.setUint16(4, 17); // segment length
  bytes[6] = 8; // precision
  view.setUint16(7, height);
  view.setUint16(9, width);
  return bytes;
}

/** JPEG with a JFIF APP0 segment before the frame header, as cameras emit. */
function jpegWithApp0(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(96);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xe0], 2); // APP0
  view.setUint16(4, 16); // APP0 length, so the frame starts at 20
  bytes.set([0xff, 0xc0], 20);
  view.setUint16(22, 17);
  bytes[24] = 8;
  view.setUint16(25, height);
  view.setUint16(27, width);
  return bytes;
}

function webpVp8xBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  bytes.set([0x56, 0x50, 0x38, 0x58], 12); // "VP8X"

  const w = width - 1;
  const h = height - 1;
  bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  bytes.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return bytes;
}

describe("inspectImage", () => {
  it("identifies a PNG and reads its dimensions", () => {
    expect(inspectImage(pngBytes(1200, 800))).toEqual({
      format: "image/png",
      width: 1200,
      height: 800,
    });
  });

  it("identifies a GIF, which stores size little-endian", () => {
    expect(inspectImage(gifBytes(320, 240))).toEqual({
      format: "image/gif",
      width: 320,
      height: 240,
    });
  });

  it("identifies a JPEG with the frame header first", () => {
    expect(inspectImage(jpegBytes(640, 480))).toEqual({
      format: "image/jpeg",
      width: 640,
      height: 480,
    });
  });

  it("walks past other JPEG segments to find the frame header", () => {
    expect(inspectImage(jpegWithApp0(4032, 3024))).toEqual({
      format: "image/jpeg",
      width: 4032,
      height: 3024,
    });
  });

  it("identifies an extended WebP", () => {
    expect(inspectImage(webpVp8xBytes(1920, 1080))).toEqual({
      format: "image/webp",
      width: 1920,
      height: 1080,
    });
  });

  it("rejects bytes that are not an image we accept", () => {
    expect(inspectImage(new TextEncoder().encode("<?php echo 1; ?>"))).toBeNull();
    expect(inspectImage(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // PDF
    expect(inspectImage(new Uint8Array(0))).toBeNull();
  });

  it("rejects a file whose name claims an image but whose bytes do not", () => {
    // A polyglot attempt: a valid PNG signature is required, not a .png suffix.
    const script = new TextEncoder().encode("GIF-but-not-really");
    expect(inspectImage(script)).toBeNull();
  });

  it("does not read past the end of a truncated header", () => {
    const truncated = pngBytes(100, 100).slice(0, 12);
    expect(() => inspectImage(truncated)).not.toThrow();
  });

  it("reports no dimensions rather than throwing on a JPEG with no frame", () => {
    const headerOnly = new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0x00]);
    expect(inspectImage(headerOnly)).toEqual({
      format: "image/jpeg",
      width: null,
      height: null,
    });
  });
});

describe("extensionFor", () => {
  it("maps each accepted format to a file extension", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("image/gif")).toBe("gif");
  });
});
