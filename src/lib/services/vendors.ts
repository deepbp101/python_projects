import { randomBytes } from "node:crypto";
import type { VendorCategory } from "@/generated/prisma/enums";
import { hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { redactBudgetItemForVendor } from "@/lib/domain/sharing";
import {
  applyRatingFloor,
  sortDirectory,
  summarizeRatings,
  vendorSlugFrom,
  type DirectoryEntry,
  type DirectorySort,
} from "@/lib/domain/vendors";

/**
 * Vendor directory, shortlists and threads.
 *
 * Two audiences read from this file and they are kept strictly apart:
 * `loadThreadForCouple` returns everything the workspace needs, while
 * `loadThreadByToken` is the vendor-facing loader and selects only what a vendor
 * may see. Anything private lives on WeddingVendor, which the token loader never
 * reaches into.
 */

/** Finds a free slug, adding a short suffix only when the base is taken. */
export async function uniqueVendorSlug(
  name: string,
  city?: string | null,
): Promise<string> {
  const base = vendorSlugFrom(name, city);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug =
      attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const clash = await prisma.vendor.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!clash) return slug;
  }

  return `${base}-${randomBytes(4).toString("hex")}`;
}

export type DirectoryQuery = {
  weddingId: string;
  q?: string | null;
  category?: VendorCategory | null;
  city?: string | null;
  minRating?: number;
  sort?: DirectorySort;
};

/**
 * Searches the shared directory.
 *
 * Text and category filtering happen in SQL; the rating floor and ordering are
 * applied afterwards because a vendor's rating is an aggregate of its reviews
 * rather than a stored column.
 */
export async function searchDirectory(query: DirectoryQuery) {
  const { weddingId, q, category, city } = query;

  const vendors = await prisma.vendor.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      category: true,
      city: true,
      region: true,
      country: true,
      website: true,
      priceTier: true,
      description: true,
      reviews: { select: { rating: true } },
      // Scoped to the caller's own wedding, so this says "on my list" without
      // disclosing anyone else's shortlist.
      shortlists: { where: { weddingId }, select: { id: true } },
    },
    take: 100,
  });

  const entries = vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    category: vendor.category,
    city: vendor.city,
    region: vendor.region,
    country: vendor.country,
    website: vendor.website,
    description: vendor.description,
    priceTier: vendor.priceTier,
    rating: summarizeRatings(vendor.reviews),
    onShortlist: vendor.shortlists.length > 0,
  }));

  return sortDirectory(
    applyRatingFloor(entries, query.minRating ?? 0) as DirectoryEntry[],
    query.sort ?? "RATING",
  ) as (DirectoryEntry & {
    region: string | null;
    country: string | null;
    website: string | null;
    description: string | null;
  })[];
}

/**
 * A vendor's public profile with its reviews.
 *
 * Reviews show the author's first name and last initial, never the wedding they
 * came from — a rating is public, but which couple hired which vendor is not.
 */
export async function loadVendorProfile(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      reviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });
  if (!vendor) return null;

  return {
    ...vendor,
    rating: summarizeRatings(vendor.reviews),
    // No wedding id goes out with a review: the rating is public, but which
    // couple hired which vendor is not, and an id is enough to correlate.
    reviews: vendor.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.createdAt,
      authorLabel: initialise(review.author?.name),
    })),
  };
}

/** "Samira Okonkwo" becomes "Samira O." — enough to be a person, not an identity. */
function initialise(name: string | null | undefined): string {
  if (!name) return "A couple";
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
}

const shortlistSelect = {
  id: true,
  status: true,
  contactName: true,
  contactEmail: true,
  notes: true,
  budgetItemId: true,
  createdAt: true,
  vendor: {
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      city: true,
      website: true,
      email: true,
      phone: true,
      priceTier: true,
      reviews: { select: { rating: true } },
    },
  },
  budgetItem: { select: { id: true, name: true, plannedAmount: true } },
  thread: {
    select: {
      id: true,
      subject: true,
      lastMessageAt: true,
      coupleReadAt: true,
      accessTokenHash: true,
      // Only the two fields the unread count needs.
      messages: { select: { authorId: true, createdAt: true } },
    },
  },
} as const;

/** The couple's own list of vendors, with thread state for the unread badges. */
export async function loadShortlist(weddingId: string) {
  return prisma.weddingVendor.findMany({
    where: { weddingId },
    select: shortlistSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function loadShortlistEntry(
  weddingId: string,
  weddingVendorId: string,
) {
  return prisma.weddingVendor.findFirst({
    where: { id: weddingVendorId, weddingId },
    select: shortlistSelect,
  });
}

/**
 * Threads are created on first use rather than when a vendor is added, so a
 * shortlist of maybes does not fill up with empty conversations.
 */
export async function ensureThread(weddingVendorId: string) {
  const existing = await prisma.vendorThread.findUnique({
    where: { weddingVendorId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.vendorThread.create({
    data: { weddingVendorId },
    select: { id: true },
  });
  return created.id;
}

const messageSelect = {
  id: true,
  authorId: true,
  authorName: true,
  body: true,
  createdAt: true,
  author: { select: { name: true } },
  attachments: {
    select: {
      id: true,
      upload: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          width: true,
          height: true,
        },
      },
    },
  },
} as const;

/** Full thread for the workspace side, including the couple's private notes. */
export async function loadThreadForCouple(
  weddingId: string,
  weddingVendorId: string,
) {
  const entry = await loadShortlistEntry(weddingId, weddingVendorId);
  if (!entry) return null;

  await ensureThread(weddingVendorId);

  const thread = await prisma.vendorThread.findUniqueOrThrow({
    where: { weddingVendorId },
    select: {
      id: true,
      subject: true,
      accessTokenHash: true,
      accessGrantedAt: true,
      lastMessageAt: true,
      coupleReadAt: true,
      vendorReadAt: true,
      messages: { select: messageSelect, orderBy: { createdAt: "asc" } },
    },
  });

  return { entry, thread, shares: await loadThreadShares(thread.id) };
}

/**
 * The vendor-facing loader.
 *
 * Every field a vendor receives is listed here explicitly. `WeddingVendor.notes`
 * and `.status` are not among them and cannot be reached from a VendorThread by
 * accident — that separation is the whole reason the thread is its own model.
 */
export async function loadThreadByToken(token: string) {
  const thread = await prisma.vendorThread.findFirst({
    where: { accessTokenHash: hashToken(token) },
    select: {
      id: true,
      subject: true,
      vendorReadAt: true,
      lastMessageAt: true,
      weddingVendor: {
        select: {
          id: true,
          contactName: true,
          vendor: { select: { name: true, category: true } },
          wedding: {
            select: {
              title: true,
              weddingDate: true,
              venueName: true,
              location: true,
            },
          },
        },
      },
      messages: { select: messageSelect, orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) return null;

  return { thread, shares: await loadThreadShares(thread.id) };
}

/**
 * Resolves what has been shared into a thread.
 *
 * The budget select is the narrow one: no `plannedAmount`, no `actualAmount`, no
 * `Payment.amount`. Those columns are never fetched, so there is nothing for a
 * later mapping mistake to leak. See src/lib/domain/sharing.ts.
 */
export async function loadThreadShares(threadId: string) {
  const shares = await prisma.threadShare.findMany({
    where: { threadId, revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      moodBoard: {
        select: {
          id: true,
          title: true,
          items: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            select: {
              id: true,
              category: true,
              title: true,
              note: true,
              sourceUrl: true,
              uploadId: true,
              upload: { select: { width: true, height: true } },
            },
          },
        },
      },
      budgetItem: {
        select: {
          id: true,
          name: true,
          payments: {
            select: { id: true, label: true, dueDate: true, paidAt: true },
          },
        },
      },
    },
  });

  return shares.map((share) => ({
    id: share.id,
    createdAt: share.createdAt,
    moodBoard: share.moodBoard,
    budgetItem: share.budgetItem
      ? redactBudgetItemForVendor(share.budgetItem)
      : null,
  }));
}

export type ThreadShareView = Awaited<ReturnType<typeof loadThreadShares>>[number];

/**
 * What the couple will send, loaded through the same narrow select the vendor
 * gets. Used by the share dialog so they can read the payload before sending.
 */
export async function previewBudgetItemForShare(
  weddingId: string,
  budgetItemId: string,
) {
  const item = await prisma.budgetItem.findFirst({
    where: { id: budgetItemId, weddingId },
    select: {
      id: true,
      name: true,
      payments: {
        select: { id: true, label: true, dueDate: true, paidAt: true },
      },
    },
  });
  return item ? redactBudgetItemForVendor(item) : null;
}

/**
 * Every budget line the couple could share, already reduced to what a vendor
 * would receive. The share dialog renders this directly, so the preview and the
 * payload cannot disagree.
 */
export async function loadShareableBudgetItems(weddingId: string) {
  const items = await prisma.budgetItem.findMany({
    where: { weddingId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      payments: {
        select: { id: true, label: true, dueDate: true, paidAt: true },
      },
    },
  });
  return items.map(redactBudgetItemForVendor);
}

/**
 * The mood board's name and size, for the share button. Deliberately a read: a
 * vendor page should not bring a mood board into existence as a side effect.
 */
export async function loadMoodBoardSummary(weddingId: string) {
  return prisma.moodBoard.findUnique({
    where: { weddingId },
    select: { title: true, _count: { select: { items: true } } },
  });
}

/** This wedding's own review of a vendor, for the edit form. */
export async function loadOwnReview(weddingId: string, vendorId: string) {
  return prisma.vendorReview.findUnique({
    where: { vendorId_weddingId: { vendorId, weddingId } },
    select: { rating: true, title: true, body: true },
  });
}

/** Marks a thread read for one side, used when the thread page is opened. */
export async function markThreadRead(
  threadId: string,
  side: "COUPLE" | "VENDOR",
) {
  await prisma.vendorThread.update({
    where: { id: threadId },
    data:
      side === "COUPLE"
        ? { coupleReadAt: new Date() }
        : { vendorReadAt: new Date() },
  });
}
