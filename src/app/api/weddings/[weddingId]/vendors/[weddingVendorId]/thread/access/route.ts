import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { ensureThread } from "@/lib/services/vendors";
import { threadAccessSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; weddingVendorId: string }> };

/**
 * Turns a vendor's access to their thread on or off.
 *
 * Vendors do not get accounts — a florist working with twenty couples will not
 * sign up twenty times, and the moment they have to, the conversation moves back
 * to email. The link is the whole credential, so only its hash is stored and the
 * raw URL is returned here once. Enabling always mints a fresh token, which means
 * revoking is final: an old link cannot be brought back to life.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId, weddingVendorId } = await params;
  const context = await requireWorkspace(weddingId, "VENDORS", "EDIT");
  const { granted } = await parseBody(request, threadAccessSchema);

  const entry = await prisma.weddingVendor.findFirst({
    where: { id: weddingVendorId, weddingId },
    select: { id: true },
  });
  if (!entry) throw notFound("That vendor is not on your list.");

  const threadId = await ensureThread(entry.id);

  if (!granted) {
    await prisma.vendorThread.update({
      where: { id: threadId },
      data: { accessTokenHash: null, accessGrantedAt: null },
    });
    broadcastChange(weddingId, "vendors", context.user.id);
    return ok({ granted: false, threadUrl: null });
  }

  const token = generateToken();
  await prisma.vendorThread.update({
    where: { id: threadId },
    data: { accessTokenHash: hashToken(token), accessGrantedAt: new Date() },
  });

  broadcastChange(weddingId, "vendors", context.user.id);
  return ok({
    granted: true,
    threadUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/vendor/${token}`,
  });
});
