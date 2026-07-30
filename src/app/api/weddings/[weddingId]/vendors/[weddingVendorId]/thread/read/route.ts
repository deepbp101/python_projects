import { notFound, ok, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ensureThread, markThreadRead } from "@/lib/services/vendors";

type Params = { params: Promise<{ weddingId: string; weddingVendorId: string }> };

/**
 * Clears the unread badge for the couple's side.
 *
 * Called when the thread is opened. Deliberately a request rather than a write
 * during render — a server component that mutates on render fires again on every
 * refresh, and the realtime layer refreshes often.
 */
export const POST = route(async (_request: Request, { params }: Params) => {
  const { weddingId, weddingVendorId } = await params;
  await requireWorkspace(weddingId, "VENDORS", "VIEW");

  const entry = await prisma.weddingVendor.findFirst({
    where: { id: weddingVendorId, weddingId },
    select: { id: true },
  });
  if (!entry) throw notFound("That vendor is not on your list.");

  await markThreadRead(await ensureThread(entry.id), "COUPLE");
  return ok({ read: true });
});
