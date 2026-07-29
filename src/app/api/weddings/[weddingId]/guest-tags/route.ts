import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { guestTagSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "GUESTS", "EDIT");
  const input = await parseBody(request, guestTagSchema);

  // Upsert rather than create: re-adding an existing tag is not an error.
  const tag = await prisma.guestTag.upsert({
    where: { weddingId_name: { weddingId, name: input.name } },
    create: { weddingId, ...input },
    update: { color: input.color },
  });

  broadcastChange(weddingId, "guests", context.user.id);
  return ok({ tag }, 201);
});
