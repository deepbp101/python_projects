import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { householdSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "GUESTS", "EDIT");
  const input = await parseBody(request, householdSchema);

  const household = await prisma.household.create({
    data: { weddingId, ...input },
  });

  broadcastChange(weddingId, "guests", context.user.id);
  return ok({ household }, 201);
});
