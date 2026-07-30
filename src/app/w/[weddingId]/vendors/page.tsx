import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { VendorBoard, type ShortlistVendor } from "@/components/vendor-board";
import { sortThreads, unreadCount } from "@/lib/domain/messaging";
import { summarizeRatings } from "@/lib/domain/vendors";
import { canChange, canSee, loadWorkspace } from "@/lib/page";
import { loadShortlist } from "@/lib/services/vendors";

export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { access } = await loadWorkspace(weddingId);

  if (!canSee(access, "VENDORS")) return <NoAccess section="Vendors" />;

  const shortlist = await loadShortlist(weddingId);

  const rows: ShortlistVendor[] = shortlist.map((entry) => {
    const rating = summarizeRatings(entry.vendor.reviews);

    return {
      id: entry.id,
      vendorId: entry.vendor.id,
      name: entry.vendor.name,
      category: entry.vendor.category,
      city: entry.vendor.city,
      priceTier: entry.vendor.priceTier,
      status: entry.status,
      contactName: entry.contactName,
      budgetItemName: entry.budgetItem?.name ?? null,
      rating: { average: rating.average, count: rating.count },
      // The hash never leaves the server; the client only needs to know a link
      // exists.
      hasLink: entry.thread?.accessTokenHash != null,
      lastMessageAt: entry.thread?.lastMessageAt?.toISOString() ?? null,
      unread: entry.thread
        ? unreadCount(entry.thread.messages, entry.thread.coupleReadAt, "COUPLE")
        : 0,
    };
  });

  return (
    <VendorBoard
      weddingId={weddingId}
      canEdit={canChange(access, "VENDORS")}
      vendors={sortThreads(rows)}
    />
  );
}
