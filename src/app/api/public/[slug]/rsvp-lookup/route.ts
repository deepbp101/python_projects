import { randomBytes } from "node:crypto";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { guardLookup } from "@/lib/rate-limit";
import { loadPublicContext } from "@/lib/services/celebrations";
import { rsvpLookupSchema } from "@/lib/validation";

type Params = { params: Promise<{ slug: string }> };

/**
 * "Find your invitation" on the public site.
 *
 * A guest types their name; if it matches exactly one person on the list, they get
 * their own RSVP link back. This is the standard way wedding sites do it, and it
 * has a standard weakness worth stating plainly: a name is not a secret, so
 * someone who knows a guest's name could reach that guest's page and reply as
 * them. What stops it being worse:
 *
 *   - the response never lists names, so the list cannot be enumerated from here;
 *     you must already know the name to match it;
 *   - an ambiguous match returns nothing rather than picking one, so it cannot be
 *     used to discover which of several people is on the list;
 *   - it is rate limited, so it cannot be brute-forced through a name dictionary;
 *   - RSVPs are visible to the couple and reversible, so a bad reply is a nuisance
 *     rather than a loss.
 *
 * Couples who want none of that can skip this and send the personal links
 * directly — the token path is the same one this hands out.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { slug } = await params;

  const site = await loadPublicContext(slug);
  if (!site) throw notFound("That wedding page does not exist.");

  await guardLookup(request, `rsvp:${site.weddingId}`);

  const { firstName, lastName } = await parseBody(request, rsvpLookupSchema);

  const matches = await prisma.guest.findMany({
    where: {
      weddingId: site.weddingId,
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    select: { id: true, itineraryTokenHash: true },
    take: 2,
  });

  // Exactly one, or nothing. Two people with the same name would otherwise let a
  // stranger learn which of them is invited.
  if (matches.length !== 1) {
    return ok({
      found: false,
      message:
        "We couldn't find that name on the list. Try the spelling on your invitation, or ask the couple for your link.",
    });
  }

  const guest = matches[0];

  // Guests invited before links were issued have no token yet; mint one now
  // rather than making them wait for the couple.
  let token: string | null = null;
  if (!guest.itineraryTokenHash) {
    token = randomBytes(24).toString("base64url");
    await prisma.guest.update({
      where: { id: guest.id },
      data: { itineraryTokenHash: hashToken(token) },
    });
  }

  return ok({
    found: true,
    // Null when they already have a link: only the hash is stored, so an existing
    // one cannot be recovered — they should use the link they were sent.
    url: token ? `/itinerary/${token}` : null,
    message: token
      ? null
      : "You've already been sent a personal link — check your email or message from the couple.",
  });
});
