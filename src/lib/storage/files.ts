import {
  extensionFor,
  inspectImage,
  type ImageFormat,
  type ImageMeta,
} from "@/lib/storage/images";

/**
 * File sniffing for message attachments.
 *
 * Vendors send quotes and contracts, so threads accept PDFs as well as images —
 * but the same rule applies as everywhere else: the format comes from the bytes,
 * never from the filename or the browser's declared MIME type. The mood board and
 * website cover keep using `inspectImage` directly, so a PDF cannot be posted
 * where an image is expected.
 */

export type DocumentFormat = "application/pdf";
export type StoredFormat = ImageFormat | DocumentFormat;

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export type FileMeta = {
  format: StoredFormat;
  width: number | null;
  height: number | null;
};

/** "%PDF-" — the whole signature, so a text file beginning with "%" is not a PDF. */
function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export function isImageFormat(format: StoredFormat): format is ImageFormat {
  return format !== "application/pdf";
}

export function extensionForStored(format: StoredFormat): string {
  return format === "application/pdf" ? "pdf" : extensionFor(format);
}

const FORMAT_LABELS: Record<StoredFormat, string> = {
  "image/jpeg": "JPEG image",
  "image/png": "PNG image",
  "image/webp": "WebP image",
  "image/gif": "GIF image",
  "application/pdf": "PDF",
};

export function formatLabel(format: string): string {
  return FORMAT_LABELS[format as StoredFormat] ?? "File";
}

/**
 * Identifies an attachment from its bytes, or null when it is not a type we
 * accept — the caller turns that into a 400.
 */
export function inspectFile(bytes: Uint8Array): FileMeta | null {
  if (isPdf(bytes)) {
    return { format: "application/pdf", width: null, height: null };
  }
  const image: ImageMeta | null = inspectImage(bytes);
  if (!image) return null;
  return { format: image.format, width: image.width, height: image.height };
}
