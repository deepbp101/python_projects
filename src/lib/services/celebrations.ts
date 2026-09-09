import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { isPubliclyVisible } from "@/lib/domain/contributions";
import { buildItinerary, type ItineraryGuest } from "@/lib/domain/itinerary";

/**
 * Guest-facing extras: the shared photo gallery, the guest book, and personal
 * itineraries.
 *
 * The gallery and guest book hang off the published wedding site rather than
 * carrying tokens of their own — the site link is already the thing guests have,
 * and a second link is a second thing to lose. Itineraries are different: they are
 * personalised, so each guest gets their own token.
 */

const photoSelect = {
  id: true,
  caption: true,
  uploaderName: true,
  approvedAt: true,
  hiddenAt: true,
  createdAt: true,
  upload: { select: { id: true, width: true, height: true } },
} as const;

const entrySelect = {
  id: true,
  kind: true,
  guestName: true,
  message: true,
  approvedAt: true,
  hiddenAt: true,
  createdAt: true,
  upload: { select: { id: true, mimeType: true } },
} as const;

/** Everything the couple sees, including submissions still waiting on them. */
export async function loadGalleryForCouple(weddingId: string) {
  return prisma.galleryPhoto.findMany({
    where: { weddingId },
    orderBy: { createdAt: "desc" },
    select: photoSelect,
  });
}

export async function loadGuestBookForCouple(weddingId: string) {
  return prisma.guestBookEntry.findMany({
    where: { weddingId },
    orderBy: { createdAt: "desc" },
    select: entrySelect,
  });
}

/**
 * Resolves a public slug to the wedding behind it, but only if the site is
 * actually published. An unpublished slug reads as if it does not exist.
 */
export async function loadPublicContext(slug: string) {
  const site = await prisma.weddingSite.findFirst({
    where: { slug, publishedAt: { not: null } },
    select: {
      weddingId: true,
      slug: true,
      galleryEnabled: true,
      galleryNote: true,
      guestBookEnabled: true,
      guestBookNote: true,
      moderateGuestPosts: true,
      wedding: { select: { title: true, weddingDate: true } },
    },
  });
  return site;
}

/**
 * The gallery as a guest sees it.
 *
 * Non-hidden rows are fetched, then filtered through the shared
 * `isPubliclyVisible` rule rather than re-expressing approval as a SQL predicate —
 * one implementation of "who can see this", used here and by the couple's badges.
 */
export async function loadPublicGallery(slug: string) {
  const site = await loadPublicContext(slug);
  if (!site || !site.galleryEnabled) return null;

  const photos = await prisma.galleryPhoto.findMany({
    where: { weddingId: site.weddingId, hiddenAt: null },
    orderBy: { createdAt: "desc" },
    select: photoSelect,
  });

  return {
    site,
    photos: photos.filter((photo) =>
      isPubliclyVisible(photo, site.moderateGuestPosts),
    ),
  };
}

export async function loadPublicGuestBook(slug: string) {
  const site = await loadPublicContext(slug);
  if (!site || !site.guestBookEnabled) return null;

  const entries = await prisma.guestBookEntry.findMany({
    where: { weddingId: site.weddingId, hiddenAt: null },
    orderBy: { createdAt: "desc" },
    select: entrySelect,
  });

  return {
    site,
    entries: entries.filter((entry) =>
      isPubliclyVisible(entry, site.moderateGuestPosts),
    ),
  };
}

/**
 * Mints itinerary links for guests who do not have one.
 *
 * Returns the raw links once — only hashes are stored, so this is the only moment
 * they exist. Guests who already hold a link are skipped unless `regenerate` is
 * set, which replaces every token and invalidates whatever was sent before.
 */
export async function issueItineraryLinks(
  weddingId: string,
  { regenerate = false }: { regenerate?: boolean } = {},
) {
  const guests = await prisma.guest.findMany({
    where: {
      weddingId,
      ...(regenerate ? {} : { itineraryTokenHash: null }),
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  const issued: { guestId: string; name: string; url: string }[] = [];

  for (const guest of guests) {
    const token = randomBytes(24).toString("base64url");
    await prisma.guest.update({
      where: { id: guest.id },
      data: { itineraryTokenHash: hashToken(token) },
    });
    issued.push({
      guestId: guest.id,
      name: `${guest.firstName} ${guest.lastName}`.trim(),
      url: `${base}/itinerary/${token}`,
    });
  }

  return issued;
}

/**
 * Loads a guest's itinerary from their token.
 *
 * Everything a guest receives is selected explicitly. Note what is absent: no
 * other guest, no household member's RSVP, no budget, no vendor. A guest's own
 * link shows their own day.
 */
export async function loadItineraryByToken(token: string) {
  const guest = await prisma.guest.findFirst({
    where: { itineraryTokenHash: hashToken(token) },
    select: {
      firstName: true,
      lastName: true,
      dietaryRestrictions: true,
      rsvp: {
        select: {
          status: true,
          message: true,
          mealOptionId: true,
          mealOption: { select: { name: true } },
        },
      },
      household: { select: { name: true } },
      plusOne: {
        select: {
          firstName: true,
          lastName: true,
          rsvp: { select: { status: true, mealOptionId: true } },
        },
      },
      seat: { select: { table: { select: { name: true } } } },
      wedding: {
        select: {
          title: true,
          weddingDate: true,
          timezone: true,
          venueName: true,
          location: true,
          mealOptions: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true, description: true },
          },
          site: {
            select: {
              travelTitle: true,
              travel: true,
              rsvpDeadline: true,
              rsvpNote: true,
              publishedAt: true,
              slug: true,
              events: {
                orderBy: [{ startsAt: "asc" }],
                select: {
                  id: true,
                  name: true,
                  startsAt: true,
                  endsAt: true,
                  venueName: true,
                  address: true,
                  description: true,
                  dressCode: true,
                  mapUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!guest) return null;

  const wedding = guest.wedding;

  const person: ItineraryGuest = {
    firstName: guest.firstName,
    lastName: guest.lastName,
    status: guest.rsvp?.status ?? "PENDING",
    mealName: guest.rsvp?.mealOption?.name ?? null,
    dietaryRestrictions: guest.dietaryRestrictions,
    tableName: guest.seat?.table.name ?? null,
    householdName: guest.household?.name ?? null,
    plusOneName: guest.plusOne
      ? `${guest.plusOne.firstName} ${guest.plusOne.lastName}`.trim()
      : null,
  };

  return {
    wedding: {
      title: wedding.title,
      weddingDate: wedding.weddingDate,
      timezone: wedding.timezone,
      venueName: wedding.venueName,
      location: wedding.location,
      travelTitle: wedding.site?.travelTitle ?? null,
      travel: wedding.site?.travel ?? null,
      rsvpDeadline: wedding.site?.rsvpDeadline ?? null,
      rsvpNote: wedding.site?.rsvpNote ?? null,
      mealOptions: wedding.mealOptions,
      /** Only linked when the site is actually published. */
      siteSlug: wedding.site?.publishedAt ? wedding.site.slug : null,
    },
    itinerary: buildItinerary({
      guest: person,
      events: wedding.site?.events ?? [],
      timezone: wedding.timezone,
    }),
    /** Current answers, so the form opens on what they last said. */
    reply: {
      status: guest.rsvp?.status ?? null,
      mealOptionId: guest.rsvp?.mealOptionId ?? null,
      message: guest.rsvp?.message ?? null,
      dietaryRestrictions: guest.dietaryRestrictions,
      plusOne: guest.plusOne
        ? {
            name: `${guest.plusOne.firstName} ${guest.plusOne.lastName}`.trim(),
            status: guest.plusOne.rsvp?.status ?? null,
            mealOptionId: guest.plusOne.rsvp?.mealOptionId ?? null,
          }
        : null,
    },
  };
}
