import { badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { buildStorageKey, getStorage } from "@/lib/storage";
import { inspectImage, MAX_UPLOAD_BYTES } from "@/lib/storage/images";
import { inspectRecording, MAX_RECORDING_BYTES } from "@/lib/storage/media";

/**
 * Uploads that arrive from guests, with no account behind them.
 *
 * Each helper accepts exactly one family of file, so the endpoint's promise ("a
 * photo", "a recording") is enforced by the bytes rather than by the caller
 * remembering. `createdById` is always null here — there is no user.
 */

const megabytes = (bytes: number) => Math.floor(bytes / 1024 / 1024);

/** Pulls the single file and the text fields out of a guest's multipart post. */
export async function readGuestForm(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) throw badRequest("Expected a multipart form.");

  const file = form.get("file");

  return {
    fields: Object.fromEntries(
      [...form.entries()]
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value as string]),
    ),
    file: file instanceof File && file.size > 0 ? file : null,
  };
}

export async function storeGuestPhoto(weddingId: string, file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw badRequest(`Photos need to be under ${megabytes(MAX_UPLOAD_BYTES)}MB.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = inspectImage(bytes);
  if (!meta) {
    throw badRequest("That doesn't look like a photo. JPEG, PNG, WebP or GIF.");
  }

  const storageKey = buildStorageKey(weddingId, meta.format);
  await getStorage().put(storageKey, bytes, meta.format);

  const upload = await prisma.upload.create({
    data: {
      weddingId,
      storageKey,
      originalName: file.name.slice(0, 200) || "photo",
      mimeType: meta.format,
      sizeBytes: bytes.byteLength,
      width: meta.width,
      height: meta.height,
      createdById: null,
    },
    select: { id: true },
  });

  return upload.id;
}

export async function storeGuestRecording(weddingId: string, file: File) {
  if (file.size > MAX_RECORDING_BYTES) {
    throw badRequest(
      `Recordings need to be under ${megabytes(MAX_RECORDING_BYTES)}MB. Try keeping it short.`,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = inspectRecording(bytes);
  if (!format) {
    throw badRequest(
      "That file isn't audio or video we can play. Try recording again.",
    );
  }

  const storageKey = buildStorageKey(weddingId, format);
  await getStorage().put(storageKey, bytes, format);

  const upload = await prisma.upload.create({
    data: {
      weddingId,
      storageKey,
      originalName: file.name.slice(0, 200) || "recording",
      mimeType: format,
      sizeBytes: bytes.byteLength,
      createdById: null,
    },
    select: { id: true, mimeType: true },
  });

  return upload;
}
