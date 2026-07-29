import { ok, parseBody, requireUser, route } from "@/lib/api";
import { createWedding, listWeddingsForUser } from "@/lib/services/wedding";
import { createWeddingSchema } from "@/lib/validation";

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ weddings: await listWeddingsForUser(user.id) });
});

export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const input = await parseBody(request, createWeddingSchema);

  const wedding = await createWedding(user.id, {
    ...input,
    weddingDate: new Date(input.weddingDate),
  });

  return ok({ wedding }, 201);
});
