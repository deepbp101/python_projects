import {
  ok,
  parseBody,
  requireWorkspace,
  requireWorkspaceOwner,
  route,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { updateWeddingSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "TASKS", "VIEW");
  return ok({
    wedding: context.wedding,
    role: context.role,
    access: context.access,
  });
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspaceOwner(weddingId);
  const input = await parseBody(request, updateWeddingSchema);

  const wedding = await prisma.wedding.update({
    where: { id: weddingId },
    data: {
      ...input,
      ...(input.weddingDate
        ? { weddingDate: new Date(input.weddingDate) }
        : {}),
    },
  });

  broadcastChange(weddingId, "wedding", context.user.id);
  return ok({ wedding });
});
