import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { siteSlugFrom } from "@/lib/domain/site";

export { siteSlugFrom };

/** Finds a free slug, adding a short suffix only when the base is taken. */
export async function uniqueSiteSlug(
  base: string,
  excludeSiteId?: string,
): Promise<string> {
  const candidate = siteSlugFrom(base);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug =
      attempt === 0
        ? candidate
        : `${candidate}-${randomBytes(2).toString("hex")}`;

    const clash = await prisma.weddingSite.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!clash || clash.id === excludeSiteId) return slug;
  }

  return `${candidate}-${randomBytes(4).toString("hex")}`;
}

/**
 * The site row is created on first visit to the builder rather than at wedding
 * creation, so a couple who never wants a website never gets an empty one.
 */
export async function ensureSite(weddingId: string) {
  const existing = await prisma.weddingSite.findUnique({
    where: { weddingId },
    include: {
      events: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
      registry: { orderBy: { sortOrder: "asc" } },
      coverImage: true,
    },
  });
  if (existing) return existing;

  const wedding = await prisma.wedding.findUniqueOrThrow({
    where: { id: weddingId },
    select: { title: true, weddingDate: true, venueName: true, location: true },
  });

  await prisma.weddingSite.create({
    data: {
      weddingId,
      slug: await uniqueSiteSlug(wedding.title),
      headline: wedding.title,
      intro: wedding.venueName
        ? `Join us at ${wedding.venueName}${wedding.location ? `, ${wedding.location}` : ""}.`
        : null,
      // A ceremony placeholder gives the couple something to edit rather than
      // an empty screen.
      events: {
        create: {
          name: "Ceremony",
          startsAt: wedding.weddingDate,
          venueName: wedding.venueName,
          address: wedding.location,
          sortOrder: 0,
        },
      },
    },
  });

  return prisma.weddingSite.findUniqueOrThrow({
    where: { weddingId },
    include: {
      events: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
      registry: { orderBy: { sortOrder: "asc" } },
      coverImage: true,
    },
  });
}

/** Loads a published site for the public page. Unpublished slugs read as 404. */
export async function loadPublishedSite(slug: string) {
  return prisma.weddingSite.findFirst({
    where: { slug, publishedAt: { not: null } },
    include: {
      events: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
      registry: { orderBy: { sortOrder: "asc" } },
      coverImage: true,
      wedding: {
        select: { title: true, weddingDate: true, timezone: true },
      },
    },
  });
}
