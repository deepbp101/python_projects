import { describe, expect, it } from "vitest";
import { extensionForStored, inspectFile } from "@/lib/storage/files";
import { inspectImage } from "@/lib/storage/images";
import {
  extensionForRecording,
  inspectRecording,
  isVideoFormat,
  MAX_RECORDING_BYTES,
} from "@/lib/storage/media";

/**
 * Guest book recordings are sniffed from their bytes like everything else — and,
 * just as importantly, each inspector accepts only its own family, so a video
 * cannot be posted where a photo belongs.
 */

function bytes(length: number, head: number[] = [], at = 0): Uint8Array {
  const buffer = new Uint8Array(length);
  buffer.set(head, at);
  return buffer;
}

const ascii = (text: string): number[] =>
  [...text].map((character) => character.charCodeAt(0));

/** RIFF....WAVE */
const wav = () => {
  const buffer = bytes(64, ascii("RIFF"));
  buffer.set(ascii("WAVE"), 8);
  return buffer;
};

/** ....ftyp<brand> */
const iso = (brand: string) => {
  const buffer = bytes(64);
  buffer.set(ascii("ftyp"), 4);
  buffer.set(ascii(brand), 8);
  return buffer;
};

const pngBytes = () => {
  const buffer = bytes(64, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  buffer.set(ascii("IHDR"), 12);
  return buffer;
};

describe("inspectRecording", () => {
  it("recognises WAV", () => {
    expect(inspectRecording(wav())).toBe("audio/wav");
  });

  it("recognises MP3, tagged or raw", () => {
    expect(inspectRecording(bytes(64, ascii("ID3")))).toBe("audio/mpeg");
    // Frame sync: 0xFF then three set high bits.
    expect(inspectRecording(bytes(64, [0xff, 0xfb]))).toBe("audio/mpeg");
  });

  it("recognises Ogg", () => {
    expect(inspectRecording(bytes(64, ascii("OggS")))).toBe("audio/ogg");
  });

  it("recognises WebM from its EBML header", () => {
    expect(inspectRecording(bytes(64, [0x1a, 0x45, 0xdf, 0xa3]))).toBe(
      "video/webm",
    );
  });

  it("tells ISO container brands apart", () => {
    expect(inspectRecording(iso("M4A "))).toBe("audio/mp4");
    expect(inspectRecording(iso("qt  "))).toBe("video/quicktime");
    expect(inspectRecording(iso("isom"))).toBe("video/mp4");
    expect(inspectRecording(iso("mp42"))).toBe("video/mp4");
  });

  it("refuses things that are not recordings", () => {
    expect(inspectRecording(pngBytes())).toBeNull();
    expect(inspectRecording(bytes(64, ascii("%PDF-1.4")))).toBeNull();
    expect(inspectRecording(bytes(64, ascii("<?php echo 1; ?>")))).toBeNull();
    expect(inspectRecording(new Uint8Array(0))).toBeNull();
  });

  it("refuses a truncated header", () => {
    expect(inspectRecording(bytes(8, ascii("RIFF")))).toBeNull();
  });
});

describe("the inspectors stay in their own lanes", () => {
  it("keeps recordings out of the image path", () => {
    // The mood board and the gallery use inspectImage — a video must not pass.
    expect(inspectImage(wav())).toBeNull();
    expect(inspectImage(iso("isom"))).toBeNull();
  });

  it("keeps recordings out of the attachment path", () => {
    // Message attachments take images and PDFs, not media.
    expect(inspectFile(wav())).toBeNull();
    expect(inspectFile(bytes(64, [0x1a, 0x45, 0xdf, 0xa3]))).toBeNull();
  });

  it("keeps images and PDFs out of the recording path", () => {
    expect(inspectRecording(pngBytes())).toBeNull();
    expect(inspectFile(pngBytes())).not.toBeNull();
  });
});

describe("format helpers", () => {
  it("maps every recording format to an extension", () => {
    expect(extensionForRecording("audio/wav")).toBe("wav");
    expect(extensionForRecording("video/webm")).toBe("webm");
    expect(extensionForRecording("video/quicktime")).toBe("mov");
  });

  it("names storage keys for recordings as well as images and PDFs", () => {
    expect(extensionForStored("audio/mpeg")).toBe("mp3");
    expect(extensionForStored("image/png")).toBe("png");
    expect(extensionForStored("application/pdf")).toBe("pdf");
  });

  it("separates video from audio", () => {
    expect(isVideoFormat("video/mp4")).toBe(true);
    expect(isVideoFormat("audio/wav")).toBe(false);
  });

  it("allows a bigger recording than a photo, but still bounded", () => {
    expect(MAX_RECORDING_BYTES).toBe(50 * 1024 * 1024);
  });
});
