import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { generateTimeline } from "@/lib/domain/timeline";
import { broadcastChange } from "@/lib/realtime/emit";
import { generateTimelineSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * (Re)generates the default checklist against the wedding date.
 *
 * By default this only adds catalog entries the wedding does not already have,
 * so re-running after a date change never destroys the couple's own edits or
 * completion history. `replaceExisting` drops the untouched generated tasks
 * first — custom tasks and anything already ticked off are always kept.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "TASKS", "EDIT");
  const { replaceExisting } = await parseBody(request, generateTimelineSchema);

  const wedding = await prisma.wedding.findUniqueOrThrow({
    where: { id: weddingId },
    select: { weddingDate: true },
  });

  let removed = 0;
  if (replaceExisting) {
    const result = await prisma.task.deleteMany({
      where: { weddingId, isCustom: false, completedAt: null },
    });
    removed = result.count;
  }

  const existing = await prisma.task.findMany({
    where: { weddingId, templateKey: { not: null } },
    select: { templateKey: true },
  });

  const tasks = generateTimeline(wedding.weddingDate, {
    existingKeys: existing
      .map((task) => task.templateKey)
      .filter((key): key is string => key !== null),
  });

  if (tasks.length > 0) {
    await prisma.task.createMany({
      data: tasks.map((task) => ({
        weddingId,
        templateKey: task.templateKey,
        title: task.title,
        description: task.description,
        category: task.category,
        milestone: task.milestone,
        priority: task.priority,
        dueDate: task.dueDate,
        sortOrder: task.sortOrder,
        isCustom: false,
      })),
    });
  }

  broadcastChange(weddingId, "tasks", context.user.id);
  return ok({
    added: tasks.length,
    removed,
    compressed: tasks.filter((task) => task.wasCompressed).length,
  });
});
