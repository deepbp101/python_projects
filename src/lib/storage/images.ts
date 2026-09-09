/**
 * Image sniffing, done from the file's own bytes.
 *
 * The browser-supplied MIME type and filename are attacker-controlled, so the
 * format is decided by the magic bytes instead. Dimensions are read from the
 * header too, which lets the mood board reserve the right aspect ratio before
 * the image loads.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ImageFormat = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type ImageMeta = {
  format: ImageFormat;
  width: number | null;
  height: number | null;
};

const EXTENSIONS: Record<ImageFormat, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function extensionFor(format: ImageFormat): string {
  return EXTENSIONS[format];
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

/**
 * Requires the full "GIF87a"/"GIF89a" signature, not just "GIF" — otherwise any
 * text file starting with those three letters sniffs as an image.
 */
function isGif(bytes: Uint8Array): boolean {
  if (bytes.length <= 10) return false;
  const signature = String.fromCharCode(...bytes.slice(0, 6));
  return signature === "GIF87a" || signature === "GIF89a";
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length > 30 &&
    // "RIFF" .... "WEBP"
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

const readU16BE = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const readU32BE = (b: Uint8Array, at: number) =>
  ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const readU16LE = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);

/** PNG carries width/height in the IHDR chunk, always at a fixed offset. */
function pngSize(bytes: Uint8Array) {
  return { width: readU32BE(bytes, 16), height: readU32BE(bytes, 20) };
}

function gifSize(bytes: Uint8Array) {
  return { width: readU16LE(bytes, 6), height: readU16LE(bytes, 8) };
}

/**
 * JPEG has no fixed header position — walk the segment markers until a frame
 * header (SOF0-SOF15, excluding the non-frame DHT/JPG/DAC markers) turns up.
 */
function jpegSize(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const isFrameHeader =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isFrameHeader) {
      return {
        height: readU16BE(bytes, offset + 5),
        width: readU16BE(bytes, offset + 7),
      };
    }
    offset += 2 + readU16BE(bytes, offset + 2);
  }
  return { width: null, height: null };
}

/** Only the common lossy/lossless VP8 chunks; anything else reports no size. */
function webpSize(bytes: Uint8Array) {
  const chunk = String.fromCharCode(...bytes.slice(12, 16));

  if (chunk === "VP8X") {
    return {
      width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
      height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
    };
  }
  if (chunk === "VP8 ") {
    return { width: readU16LE(bytes, 26) & 0x3fff, height: readU16LE(bytes, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return { width: null, height: null };
}

/**
 * Identifies an image from its bytes. Returns null when the bytes are not one
 * of the formats we accept — the caller turns that into a 400.
 */
export function inspectImage(bytes: Uint8Array): ImageMeta | null {
  if (isPng(bytes)) return { format: "image/png", ...pngSize(bytes) };
  if (isJpeg(bytes)) return { format: "image/jpeg", ...jpegSize(bytes) };
  if (isGif(bytes)) return { format: "image/gif", ...gifSize(bytes) };
  if (isWebp(bytes)) return { format: "image/webp", ...webpSize(bytes) };
  return null;
}
