import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ThreadMessage } from "@/components/message-list";
import { NoAccess } from "@/components/no-access";
import { StarRating } from "@/components/stars";
import { Badge, Card } from "@/components/ui";
import { VendorSettings } from "@/components/vendor-settings";
import { VendorThreadPanel, type ActiveShare } from "@/components/vendor-thread";
import { unreadCount } from "@/lib/domain/messaging";
import {
  priceTierLabel,
  summarizeRatings,
  VENDOR_CATEGORY_LABELS,
  VENDOR_STATUS_LABELS,
  VENDOR_STATUS_TONES,
} from "@/lib/domain/vendors";
import { canChange, canSee, loadWorkspace } from "@/lib/page";
import {
  loadMoodBoardSummary,
  loadOwnReview,
  loadShareableBudgetItems,
  loadThreadForCouple,
} from "@/lib/services/vendors";

export const metadata: Metadata = { title: "Vendor" };

type Params = { params: Promise<{ weddingId: string; weddingVendorId: string }> };

export default async function VendorDetailPage({ params }: Params) {
  const { weddingId, weddingVendorId } = await params;
  const { access } = await loadWorkspace(weddingId);

  if (!canSee(access, "VENDORS")) return <NoAccess section="Vendors" />;

  const loaded = await loadThreadForCouple(weddingId, weddingVendorId);
  if (!loaded) notFound();

  const { entry, thread, shares } = loaded;
  const canEdit = canChange(access, "VENDORS");

  // Sharing a payment schedule needs budget access, and sharing the mood board
  // needs mood board access — so neither option is offered without it.
  const [shareableItems, review, moodBoard] = await Promise.all([
    canSee(access, "BUDGET") ? loadShareableBudgetItems(weddingId) : null,
    loadOwnReview(weddingId, entry.vendor.id),
    canSee(access, "MOODBOARD") ? loadMoodBoardSummary(weddingId) : null,
  ]);

  const rating = summarizeRatings(entry.vendor.reviews);

  const messages: ThreadMessage[] = thread.messages.map((message) => ({
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    accountName: message.author?.name ?? null,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      uploadId: attachment.upload.id,
      originalName: attachment.upload.originalName,
      mimeType: attachment.upload.mimeType,
      sizeBytes: attachment.upload.sizeBytes,
      width: attachment.upload.width,
      height: attachment.upload.height,
    })),
  }));

  const activeShares: ActiveShare[] = shares.map((share) =>
    share.budgetItem
      ? {
          id: share.id,
          kind: "BUDGET_ITEM",
          label: share.budgetItem.name,
          budgetItemId: share.budgetItem.id,
          payments: share.budgetItem.payments,
        }
      : {
          id: share.id,
          kind: "MOOD_BOARD",
          label: share.moodBoard?.title ?? "Mood board",
          budgetItemId: null,
          payments: null,
        },
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-5 sm:p-8">
      <Link
        href={`/w/${weddingId}/vendors`}
        className="text-sm text-ink-soft underline-offset-4 hover:underline"
      >
        ← All vendors
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-ink">
              {entry.vendor.name}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {VENDOR_CATEGORY_LABELS[entry.vendor.category]}
              {entry.vendor.city && ` · ${entry.vendor.city}`}
              {entry.vendor.priceTier &&
                ` · ${priceTierLabel(entry.vendor.priceTier)}`}
            </p>
            <StarRating
              className="mt-2"
              value={rating.average}
              count={rating.count}
            />
          </div>
          <Badge tone={VENDOR_STATUS_TONES[entry.status]}>
            {VENDOR_STATUS_LABELS[entry.status]}
          </Badge>
        </div>

        {(entry.vendor.website || entry.vendor.phone || entry.vendor.email) && (
          <dl className="mt-4 grid gap-2 border-t border-line pt-4 text-sm sm:grid-cols-3">
            {entry.vendor.website && (
              <div>
                <dt className="text-xs text-ink-faint">Website</dt>
                <dd>
                  <a
                    href={entry.vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-clay-dark underline underline-offset-2"
                  >
                    {entry.vendor.website.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </div>
            )}
            {entry.vendor.phone && (
              <div>
                <dt className="text-xs text-ink-faint">Phone</dt>
                <dd className="text-ink">{entry.vendor.phone}</dd>
              </div>
            )}
            {entry.vendor.email && (
              <div>
                <dt className="text-xs text-ink-faint">Email</dt>
                <dd className="truncate text-ink">{entry.vendor.email}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <VendorThreadPanel
          weddingId={weddingId}
          weddingVendorId={entry.id}
          vendorName={entry.vendor.name}
          canEdit={canEdit}
          messages={messages}
          shares={activeShares}
          shareableItems={shareableItems}
          moodBoardTitle={
            moodBoard && moodBoard._count.items > 0 ? moodBoard.title : null
          }
          unread={unreadCount(thread.messages, thread.coupleReadAt, "COUPLE")}
        />

        <VendorSettings
          weddingId={weddingId}
          weddingVendorId={entry.id}
          vendorName={entry.vendor.name}
          canEdit={canEdit}
          status={entry.status}
          contactName={entry.contactName}
          contactEmail={entry.contactEmail}
          notes={entry.notes}
          budgetItemId={entry.budgetItemId}
          budgetItems={
            shareableItems
              ? shareableItems.map((item) => ({
                  id: item.id,
                  name: item.name,
                }))
              : null
          }
          review={
            review
              ? {
                  rating: review.rating,
                  title: review.title ?? "",
                  body: review.body ?? "",
                }
              : null
          }
          hasLink={thread.accessTokenHash !== null}
        />
      </div>
    </main>
  );
}
