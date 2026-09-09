import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { createTaskSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "TASKS", "VIEW");

  const tasks = await prisma.task.findMany({
    where: { weddingId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      completedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
  });

  return ok({ tasks });
});

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "TASKS", "EDIT");
  const input = await parseBody(request, createTaskSchema);

  const task = await prisma.task.create({
    data: {
      weddingId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      milestone: input.milestone,
      priority: input.priority,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assignedToId: input.assignedToId ?? null,
      isCustom: true,
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      completedBy: { select: { id: true, name: true } },
    },
  });

  broadcastChange(weddingId, "tasks", context.user.id);
  return ok({ task }, 201);
});
