import { notFound, route, unauthorized } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { resolveUploadAccess } from "@/lib/services/uploads";

type Params = { params: Promise<{ uploadId: string }> };

/**
 * Serves an uploaded image.
 *
 * Files are not static assets — every read goes through the same access rules
 * as the rest of the workspace, so a mood board stays private until its owner
 * shares it. Storage keys are random, but obscurity is not the control here.
 */
export const GET = route(async (request: Request, { params }: Params) => {
  const { uploadId } = await params;
  const shareToken = new URL(request.url).searchParams.get("share");

  const access = await resolveUploadAccess(uploadId, shareToken);
  if (!access) throw notFound("That file does not exist.");
  if (!access.allowed) throw unauthorized("You cannot view that file.");

  const bytes = await getStorage().get(access.storageKey);
  if (!bytes) throw notFound("That file is no longer stored.");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": access.mimeType,
      "Content-Length": String(bytes.byteLength),
      // Keys are content-addressed by randomness and never reused, so the bytes
      // behind a URL never change.
      "Cache-Control": access.isPublic
        ? "public, max-age=31536000, immutable"
        : "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
