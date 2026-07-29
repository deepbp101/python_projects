import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { summarizeSeating, suggestTables } from "@/lib/domain/seating";
import { broadcastChange } from "@/lib/realtime/emit";
import { autoLayoutSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

/** Tables, who is sitting where, and the guests still to be placed. */
export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "SEATING", "VIEW");

  const [tables, guests] = await Promise.all([
    prisma.seatingTable.findMany({
      where: { weddingId },
      include: { assignments: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.guest.findMany({
      where: { weddingId },
      include: { rsvp: true, seat: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const assignments = tables.flatMap((table) =>
    table.assignments.map((assignment) => ({
      guestId: assignment.guestId,
      tableId: table.id,
    })),
  );

  return ok({
    tables,
    assignments,
    summary: summarizeSeating(tables, assignments, guests),
  });
});

/**
 * Lays out a starting floor plan sized to the guest list. Only runs on an empty
 * chart, so it can never wipe a plan the couple has already arranged.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "SEATING", "EDIT");
  const { perTable } = await parseBody(request, autoLayoutSchema);

  const existing = await prisma.seatingTable.count({ where: { weddingId } });
  if (existing > 0) {
    return ok({ created: 0, reason: "The chart already has tables." });
  }

  const guests = await prisma.guest.findMany({
    where: { weddingId },
    include: { rsvp: true },
  });
  const seatable = guests.filter((guest) =>
    ["ATTENDING", "MAYBE"].includes(guest.rsvp?.status ?? "PENDING"),
  ).length;

  const tables = suggestTables(seatable, { perTable });
  await prisma.seatingTable.createMany({
    data: tables.map((table) => ({ weddingId, ...table })),
  });

  broadcastChange(weddingId, "seating", context.user.id);
  return ok({ created: tables.length }, 201);
});
