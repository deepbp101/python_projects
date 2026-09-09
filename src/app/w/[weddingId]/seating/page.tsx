import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { SeatingBoard } from "@/components/seating-board";
import { prisma } from "@/lib/db";
import { statusOf } from "@/lib/domain/rsvp";
import { summarizeSeating } from "@/lib/domain/seating";
import { canChange, canSee, loadWorkspace } from "@/lib/page";

export const metadata: Metadata = { title: "Seating chart" };

export default async function SeatingPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { access } = await loadWorkspace(weddingId);

  if (!canSee(access, "SEATING")) return <NoAccess section="The seating chart" />;

  const [tables, guests] = await Promise.all([
    prisma.seatingTable.findMany({
      where: { weddingId },
      include: { assignments: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.guest.findMany({
      where: { weddingId },
      include: { rsvp: true, seat: true, household: { select: { name: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const assignments = tables.flatMap((table) =>
    table.assignments.map((assignment) => ({
      guestId: assignment.guestId,
      tableId: table.id,
    })),
  );

  return (
    <SeatingBoard
      weddingId={weddingId}
      canEdit={canChange(access, "SEATING")}
      summary={summarizeSeating(tables, assignments, guests)}
      tables={tables.map((table) => ({
        id: table.id,
        name: table.name,
        shape: table.shape,
        capacity: table.capacity,
        x: table.x,
        y: table.y,
      }))}
      assignments={assignments}
      guests={guests.map((guest) => ({
        id: guest.id,
        name: `${guest.firstName} ${guest.lastName}`.trim(),
        status: statusOf(guest),
        householdName: guest.household?.name ?? null,
        dietaryRestrictions: guest.dietaryRestrictions,
      }))}
    />
  );
}
