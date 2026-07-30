import { describe, expect, it } from "vitest";
import {
  extensionForStored,
  inspectFile,
  isImageFormat,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/storage/files";

/**
 * Attachment sniffing. Threads accept PDFs on top of images because vendors send
 * quotes and contracts — but the format still comes from the bytes, so a script
 * renamed `.pdf` is refused the same way a script renamed `.png` always was.
 */

const bytesOf = (text: string, length = 64): Uint8Array => {
  const bytes = new Uint8Array(length);
  for (let index = 0; index < text.length && index < length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }
  return bytes;
};

function pngBytes(): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 800);
  view.setUint32(20, 600);
  return bytes;
}

describe("inspectFile", () => {
  it("recognises a PDF", () => {
    expect(inspectFile(bytesOf("%PDF-1.7\n%âãÏÓ"))).toEqual({
      format: "application/pdf",
      width: null,
      height: null,
    });
  });

  it("still recognises images, dimensions included", () => {
    expect(inspectFile(pngBytes())).toEqual({
      format: "image/png",
      width: 800,
      height: 600,
    });
  });

  it("requires the whole %PDF- signature, hyphen included", () => {
    expect(inspectFile(bytesOf("%PDF-1.4 trailer"))).not.toBeNull();
    expect(inspectFile(bytesOf("%PDF but not really"))).toBeNull();
    expect(inspectFile(bytesOf("% just a comment file"))).toBeNull();
  });

  it("refuses a script dressed up as a document", () => {
    expect(inspectFile(bytesOf("<?php system($_GET['c']); ?>"))).toBeNull();
    expect(inspectFile(bytesOf("#!/bin/sh\nrm -rf /"))).toBeNull();
  });

  it("refuses an empty or truncated file", () => {
    expect(inspectFile(new Uint8Array(0))).toBeNull();
    expect(inspectFile(bytesOf("%PDF", 4))).toBeNull();
  });
});

describe("format helpers", () => {
  it("maps every accepted format to an extension", () => {
    expect(extensionForStored("application/pdf")).toBe("pdf");
    expect(extensionForStored("image/jpeg")).toBe("jpg");
    expect(extensionForStored("image/webp")).toBe("webp");
  });

  it("separates documents from images", () => {
    expect(isImageFormat("image/png")).toBe(true);
    expect(isImageFormat("application/pdf")).toBe(false);
  });

  it("allows a larger attachment than a mood board image, but not unbounded", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(15 * 1024 * 1024);
  });
});
