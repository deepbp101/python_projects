import { deflateSync } from "node:zlib";

/**
 * A tiny PNG encoder, used only by the seed.
 *
 * The demo mood board needs real image bytes — the upload pipeline sniffs magic
 * bytes and reads dimensions, so placeholder text files would not survive it.
 * Generating swatches keeps the repository free of binary fixtures.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, Buffer.from(data)]);

  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

/** A soft vertical gradient in the given colour, so swatches read as photos-ish. */
export function makePng(
  width: number,
  height: number,
  [r, g, b]: [number, number, number],
): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter: none

    // Lighten towards the bottom of the image.
    const shade = 0.75 + 0.25 * (y / Math.max(height - 1, 1));
    for (let x = 0; x < width; x += 1) {
      const at = rowStart + 1 + x * 3;
      raw[at] = Math.min(255, Math.round(r * shade));
      raw[at + 1] = Math.min(255, Math.round(g * shade));
      raw[at + 2] = Math.min(255, Math.round(b * shade));
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
