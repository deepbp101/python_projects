import { badRequest, ok, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { buildStorageKey, getStorage } from "@/lib/storage";
import { inspectImage, MAX_UPLOAD_BYTES } from "@/lib/storage/images";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * Image upload, shared by the mood board and the website cover.
 *
 * The declared MIME type and filename are ignored for anything that matters:
 * the format comes from the file's own magic bytes and the storage key is
 * generated server-side.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;

  const form = await request.formData().catch(() => null);
  if (!form) throw badRequest("Expected a multipart form upload.");

  const section = form.get("section");
  if (section !== "MOODBOARD" && section !== "WEBSITE") {
    throw badRequest("Uploads must declare a section of MOODBOARD or WEBSITE.");
  }

  // Permission is checked against the section the file is destined for.
  const context = await requireWorkspace(weddingId, section, "EDIT");

  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("No file was included.");
  if (file.size === 0) throw badRequest("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw badRequest(
      `Images need to be under ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = inspectImage(bytes);
  if (!meta) {
    throw badRequest("That doesn't look like a JPEG, PNG, WebP or GIF image.");
  }

  const storageKey = buildStorageKey(weddingId, meta.format);
  await getStorage().put(storageKey, bytes, meta.format);

  const upload = await prisma.upload.create({
    data: {
      weddingId,
      storageKey,
      originalName: file.name.slice(0, 200) || "upload",
      mimeType: meta.format,
      sizeBytes: bytes.byteLength,
      width: meta.width,
      height: meta.height,
      createdById: context.user.id,
    },
  });

  return ok(
    {
      upload: {
        id: upload.id,
        url: `/api/files/${upload.id}`,
        width: upload.width,
        height: upload.height,
        mimeType: upload.mimeType,
      },
    },
    201,
  );
});
