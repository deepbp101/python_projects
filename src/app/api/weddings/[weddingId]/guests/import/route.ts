import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { findOrCreateHousehold, findOrCreateTag } from "@/lib/services/guests";
import { importGuestsSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * Bulk guest import.
 *
 * Households and tags arrive as names rather than ids — the couple is pasting a
 * spreadsheet, not picking from dropdowns — so both are resolved or created on
 * the fly and reused across rows.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "GUESTS", "EDIT");
  const { guests } = await parseBody(request, importGuestsSchema);

  const householdIds = new Map<string, string>();
  const tagIds = new Map<string, string>();
  let created = 0;

  for (const row of guests) {
    let householdId: string | null = null;
    if (row.householdName) {
      const cached = householdIds.get(row.householdName);
      householdId =
        cached ?? (await findOrCreateHousehold(weddingId, row.householdName));
      householdIds.set(row.householdName, householdId);
    }

    const resolvedTagIds: string[] = [];
    for (const tagName of row.tags) {
      const cached = tagIds.get(tagName);
      const tagId = cached ?? (await findOrCreateTag(weddingId, tagName));
      tagIds.set(tagName, tagId);
      resolvedTagIds.push(tagId);
    }

    await prisma.guest.create({
      data: {
        weddingId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email ?? null,
        phone: row.phone ?? null,
        ageGroup: row.ageGroup,
        dietaryRestrictions: row.dietaryRestrictions ?? null,
        plusOneAllowed: row.plusOneAllowed,
        householdId,
        rsvp: { create: { status: "PENDING" } },
        tags: { create: resolvedTagIds.map((tagId) => ({ tagId })) },
      },
    });
    created += 1;
  }

  broadcastChange(weddingId, "guests", context.user.id);
  return ok({ created }, 201);
});
