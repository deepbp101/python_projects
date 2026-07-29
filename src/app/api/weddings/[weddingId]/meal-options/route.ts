import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { mealOptionSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "GUESTS", "EDIT");
  const input = await parseBody(request, mealOptionSchema);

  const meal = await prisma.mealOption.upsert({
    where: { weddingId_name: { weddingId, name: input.name } },
    create: { weddingId, ...input },
    update: { description: input.description, sortOrder: input.sortOrder },
  });

  broadcastChange(weddingId, "guests", context.user.id);
  return ok({ meal }, 201);
});
