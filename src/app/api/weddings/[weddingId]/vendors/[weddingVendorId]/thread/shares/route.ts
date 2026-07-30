import { badRequest, notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { ensureMoodBoard } from "@/lib/services/moodboard";
import { ensureThread, loadThreadShares } from "@/lib/services/vendors";
import { revokeShareSchema, shareIntoThreadSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; weddingVendorId: string }> };

async function requireEntry(weddingId: string, weddingVendorId: string) {
  const entry = await prisma.weddingVendor.findFirst({
    where: { id: weddingVendorId, weddingId },
    select: { id: true },
  });
  if (!entry) throw notFound("That vendor is not on your list.");
  return entry;
}

/**
 * Shares a mood board or one budget line into a vendor thread.
 *
 * Two permissions are checked, not one: VENDORS EDIT to write into the thread,
 * and VIEW on the section the thing comes from. Family, who have no budget
 * access at all, therefore cannot forward a payment schedule even if someone
 * hands them the vendor page.
 *
 * What the vendor actually receives is decided by the loader in
 * src/lib/services/vendors.ts — a budget line goes out as its schedule with every
 * amount stripped. See src/lib/domain/sharing.ts for why.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId, weddingVendorId } = await params;
  const context = await requireWorkspace(weddingId, "VENDORS", "EDIT");
  const input = await parseBody(request, shareIntoThreadSchema);

  const entry = await requireEntry(weddingId, weddingVendorId);
  const threadId = await ensureThread(entry.id);

  let moodBoardId: string | null = null;
  let budgetItemId: string | null = null;
  let announcement: string;

  if (input.moodBoard) {
    await requireWorkspace(weddingId, "MOODBOARD", "VIEW");
    const board = await ensureMoodBoard(weddingId);
    moodBoardId = board.id;
    announcement = `Shared our mood board, "${board.title}".`;
  } else {
    await requireWorkspace(weddingId, "BUDGET", "VIEW");
    const item = await prisma.budgetItem.findFirst({
      where: { id: input.budgetItemId, weddingId },
      select: { id: true, name: true },
    });
    if (!item) throw notFound("That budget line does not exist.");
    budgetItemId = item.id;
    announcement = `Shared the payment schedule for "${item.name}".`;
  }

  const existing = await prisma.threadShare.findFirst({
    where: { threadId, moodBoardId, budgetItemId },
    select: { id: true, revokedAt: true },
  });

  if (existing && existing.revokedAt === null) {
    throw badRequest("That is already shared in this thread.");
  }

  const message = await prisma.message.create({
    data: { threadId, authorId: context.user.id, body: announcement },
    select: { id: true, createdAt: true },
  });

  // Re-sharing revives the original row rather than inserting a second one, so
  // the one-share-per-resource-per-thread constraint holds.
  if (existing) {
    await prisma.threadShare.update({
      where: { id: existing.id },
      data: {
        revokedAt: null,
        messageId: message.id,
        sharedById: context.user.id,
      },
    });
  } else {
    await prisma.threadShare.create({
      data: {
        threadId,
        moodBoardId,
        budgetItemId,
        messageId: message.id,
        sharedById: context.user.id,
      },
    });
  }

  await prisma.vendorThread.update({
    where: { id: threadId },
    data: { lastMessageAt: message.createdAt, coupleReadAt: message.createdAt },
  });

  broadcastChange(weddingId, "messages", context.user.id);
  return ok({ shares: await loadThreadShares(threadId) }, 201);
});

/**
 * Withdraws a share. The announcing message stays so the history still reads
 * correctly, but the vendor's access to the resource — including any images on a
 * shared mood board — stops at once.
 */
export const DELETE = route(async (request: Request, { params }: Params) => {
  const { weddingId, weddingVendorId } = await params;
  const context = await requireWorkspace(weddingId, "VENDORS", "EDIT");
  const { shareId } = await parseBody(request, revokeShareSchema);

  const entry = await requireEntry(weddingId, weddingVendorId);
  const threadId = await ensureThread(entry.id);

  const share = await prisma.threadShare.findFirst({
    where: { id: shareId, threadId },
    select: { id: true },
  });
  if (!share) throw notFound("That share does not exist.");

  await prisma.threadShare.update({
    where: { id: share.id },
    data: { revokedAt: new Date() },
  });

  broadcastChange(weddingId, "messages", context.user.id);
  return ok({ shares: await loadThreadShares(threadId) });
});
