import { badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/domain/messaging";
import { buildStorageKey, getStorage } from "@/lib/storage";
import { inspectFile, MAX_ATTACHMENT_BYTES } from "@/lib/storage/files";

/**
 * Stores the files sent with a message.
 *
 * Shared by both sides of a thread — the couple posting from the workspace and
 * the vendor replying through their link — so an anonymous vendor upload goes
 * through exactly the same byte-level validation as everything else. `createdById`
 * is null for the vendor, since there is no account behind them.
 */
export async function storeAttachments(
  weddingId: string,
  files: File[],
  createdById: string | null,
) {
  const real = files.filter((file) => file.size > 0);

  if (real.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw badRequest(
      `Send up to ${MAX_ATTACHMENTS_PER_MESSAGE} files at a time.`,
    );
  }

  const uploadIds: string[] = [];

  for (const file of real) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw badRequest(
        `"${file.name}" is over ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB.`,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const meta = inspectFile(bytes);
    if (!meta) {
      throw badRequest(
        `"${file.name}" is not a PDF, JPEG, PNG, WebP or GIF. Attachments are checked by their contents, not their name.`,
      );
    }

    const storageKey = buildStorageKey(weddingId, meta.format);
    await getStorage().put(storageKey, bytes, meta.format);

    const upload = await prisma.upload.create({
      data: {
        weddingId,
        storageKey,
        originalName: file.name.slice(0, 200) || "attachment",
        mimeType: meta.format,
        sizeBytes: bytes.byteLength,
        width: meta.width,
        height: meta.height,
        createdById,
      },
      select: { id: true },
    });

    uploadIds.push(upload.id);
  }

  return uploadIds;
}

/** Pulls the text body and files out of a multipart message post. */
export async function readMessageForm(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) throw badRequest("Expected a multipart form.");

  return {
    fields: Object.fromEntries(
      [...form.entries()]
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value as string]),
    ),
    files: form.getAll("files").filter((value): value is File => value instanceof File),
  };
}
