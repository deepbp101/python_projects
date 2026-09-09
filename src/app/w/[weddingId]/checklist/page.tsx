import type { Metadata } from "next";
import { ChecklistBoard } from "@/components/checklist-board";
import { NoAccess } from "@/components/no-access";
import { prisma } from "@/lib/db";
import { canChange, canSee, loadWorkspace } from "@/lib/page";

export const metadata: Metadata = { title: "Checklist" };

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { access } = await loadWorkspace(weddingId);

  if (!canSee(access, "TASKS")) return <NoAccess section="The checklist" />;

  const [tasks, collaborators] = await Promise.all([
    prisma.task.findMany({
      where: { weddingId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.collaborator.findMany({
      where: { weddingId, status: "ACTIVE" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <ChecklistBoard
      weddingId={weddingId}
      canEdit={canChange(access, "TASKS")}
      collaborators={collaborators}
      tasks={tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        milestone: task.milestone,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        completedAt: task.completedAt ? task.completedAt.toISOString() : null,
        isCustom: task.isCustom,
        assignedTo: task.assignedTo,
      }))}
    />
  );
}
