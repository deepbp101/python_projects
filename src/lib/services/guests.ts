import { prisma } from "@/lib/db";

/** The shape every guest endpoint returns, so the client always gets the same object. */
export const guestInclude = {
  rsvp: true,
  household: true,
  tags: { include: { tag: true } },
  plusOne: { select: { id: true, firstName: true, lastName: true } },
} as const;

/**
 * Finds a household by name within a wedding, creating it if needed. Used by
 * the bulk import, where households arrive as free text.
 */
export async function findOrCreateHousehold(
  weddingId: string,
  name: string,
): Promise<string> {
  const existing = await prisma.household.findFirst({
    where: { weddingId, name },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.household.create({
    data: { weddingId, name },
    select: { id: true },
  });
  return created.id;
}

/** Same idea for tags, which the import accepts as names rather than ids. */
export async function findOrCreateTag(
  weddingId: string,
  name: string,
): Promise<string> {
  const tag = await prisma.guestTag.upsert({
    where: { weddingId_name: { weddingId, name } },
    create: { weddingId, name },
    update: {},
    select: { id: true },
  });
  return tag.id;
}
