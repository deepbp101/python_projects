import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { ensureMoodBoard } from "@/lib/services/moodboard";
import { shareMoodBoardSchema } from "@/lib/validation";
import { requireFeature } from "@/lib/services/plan";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * Turns public sharing on or off.
 *
 * Enabling mints a fresh token every time, so re-sharing after a revoke never
 * resurrects a link someone still has. Only the hash is stored, which means the
 * raw link is returned here once and cannot be recovered later.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "MOODBOARD", "EDIT");
  const { shared } = await parseBody(request, shareMoodBoardSchema);

  // Only gate turning it on — revoking must always work, whatever the plan.
  if (shared) await requireFeature(weddingId, "moodBoardSharing");

  const board = await ensureMoodBoard(weddingId);

  if (!shared) {
    await prisma.moodBoard.update({
      where: { id: board.id },
      data: { shareTokenHash: null, sharedAt: null },
    });
    broadcastChange(weddingId, "moodboard", context.user.id);
    return ok({ shared: false, shareUrl: null });
  }

  const token = generateToken();
  await prisma.moodBoard.update({
    where: { id: board.id },
    data: { shareTokenHash: hashToken(token), sharedAt: new Date() },
  });

  broadcastChange(weddingId, "moodboard", context.user.id);
  return ok({
    shared: true,
    shareUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/moodboard/${token}`,
  });
});
