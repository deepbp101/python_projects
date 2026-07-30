import { notFound, ok, route } from "@/lib/api";
import { hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { readMessageForm, storeAttachments } from "@/lib/services/attachments";
import { vendorReplySchema } from "@/lib/validation";

type Params = { params: Promise<{ token: string }> };

/**
 * A vendor's reply, sent with no account.
 *
 * The token in their link is the entire credential, so an unknown or revoked one
 * is a flat 404 — the same answer a token that never existed gets. Attachments go
 * through the same byte-level checks as everything else, and the upload is
 * recorded against the wedding with no `createdById`, since there is no user
 * behind it.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { token } = await params;

  const thread = await prisma.vendorThread.findFirst({
    where: { accessTokenHash: hashToken(token) },
    select: {
      id: true,
      weddingVendor: {
        select: {
          weddingId: true,
          contactName: true,
          vendor: { select: { name: true } },
        },
      },
    },
  });
  if (!thread) throw notFound("This conversation is no longer available.");

  const { weddingId } = thread.weddingVendor;
  const { fields, files } = await readMessageForm(request);
  const { body, authorName } = vendorReplySchema.parse(fields);

  const uploadIds = await storeAttachments(weddingId, files, null);

  const message = await prisma.message.create({
    data: {
      threadId: thread.id,
      // Null author is what marks a message as the vendor's side.
      authorId: null,
      authorName:
        authorName?.trim() ||
        thread.weddingVendor.contactName ||
        thread.weddingVendor.vendor.name,
      body,
      attachments: { create: uploadIds.map((uploadId) => ({ uploadId })) },
    },
    select: { id: true, createdAt: true },
  });

  await prisma.vendorThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: message.createdAt, vendorReadAt: message.createdAt },
  });

  // No actor id: every collaborator should see this arrive, including whoever
  // happens to have the thread open.
  broadcastChange(weddingId, "messages", null);

  return ok({ message }, 201);
});
