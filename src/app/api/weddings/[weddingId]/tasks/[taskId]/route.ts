import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { updateTaskSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; taskId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, taskId } = await params;
  const context = await requireWorkspace(weddingId, "TASKS", "EDIT");
  const input = await parseBody(request, updateTaskSchema);

  const existing = await prisma.task.findFirst({
    where: { id: taskId, weddingId },
  });
  if (!existing) throw notFound("That task does not exist.");

  const { completed, dueDate, ...rest } = input;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...rest,
      ...(dueDate !== undefined
        ? { dueDate: dueDate ? new Date(dueDate) : null }
        : {}),
      // Completion records who ticked it off, which the activity view uses.
      ...(completed === undefined
        ? {}
        : completed
          ? { completedAt: new Date(), completedById: context.user.id }
          : { completedAt: null, completedById: null }),
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      completedBy: { select: { id: true, name: true } },
    },
  });

  broadcastChange(weddingId, "tasks", context.user.id);
  return ok({ task });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, taskId } = await params;
  const context = await requireWorkspace(weddingId, "TASKS", "EDIT");

  const { count } = await prisma.task.deleteMany({
    where: { id: taskId, weddingId },
  });
  if (count === 0) throw notFound("That task does not exist.");

  broadcastChange(weddingId, "tasks", context.user.id);
  return ok({ ok: true });
});
