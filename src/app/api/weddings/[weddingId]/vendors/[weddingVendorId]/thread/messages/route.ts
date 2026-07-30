import { notFound, ok, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { readMessageForm, storeAttachments } from "@/lib/services/attachments";
import { ensureThread } from "@/lib/services/vendors";
import { sendMessageSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; weddingVendorId: string }> };

/**
 * Posts a message to a vendor.
 *
 * Multipart rather than JSON because a message and its attachments are one
 * action — a quote arriving in two requests can half-fail and leave a file with
 * no message or a message referring to a file that never landed.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId, weddingVendorId } = await params;
  const context = await requireWorkspace(weddingId, "VENDORS", "EDIT");

  const entry = await prisma.weddingVendor.findFirst({
    where: { id: weddingVendorId, weddingId },
    select: { id: true },
  });
  if (!entry) throw notFound("That vendor is not on your list.");

  const threadId = await ensureThread(entry.id);
  const { fields, files } = await readMessageForm(request);
  const { body } = sendMessageSchema.parse(fields);

  const uploadIds = await storeAttachments(weddingId, files, context.user.id);

  const message = await prisma.message.create({
    data: {
      threadId,
      authorId: context.user.id,
      body,
      attachments: { create: uploadIds.map((uploadId) => ({ uploadId })) },
    },
    select: { id: true, createdAt: true },
  });

  await prisma.vendorThread.update({
    where: { id: threadId },
    // Sending is also reading: the couple has clearly seen the thread.
    data: { lastMessageAt: message.createdAt, coupleReadAt: message.createdAt },
  });

  broadcastChange(weddingId, "messages", context.user.id);
  return ok({ message }, 201);
});
