import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageList, type ThreadMessage } from "@/components/message-list";
import { MoodCard } from "@/components/mood-board";
import { VendorReplyBox } from "@/components/vendor-reply";
import { Badge, Card, CardTitle } from "@/components/ui";
import { formatDate, formatLongDate } from "@/lib/dates";
import { VENDOR_CATEGORY_LABELS } from "@/lib/domain/vendors";
import { loadThreadByToken } from "@/lib/services/vendors";

type Params = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Your conversation",
  robots: { index: false },
};

/**
 * The vendor's view of a thread — no account, just the link they were sent.
 *
 * Everything on this page comes from `loadThreadByToken`, which selects the
 * couple's private notes and status nowhere. A revoked or unknown token is a flat
 * 404, the same answer as a token that never existed.
 */
export default async function VendorThreadPage({ params }: Params) {
  const { token } = await params;
  const loaded = await loadThreadByToken(token);
  if (!loaded) notFound();

  const { thread, shares } = loaded;
  const { vendor, wedding, contactName } = thread.weddingVendor;

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

  const moodBoards = shares.flatMap((share) =>
    share.moodBoard ? [share.moodBoard] : [],
  );
  const schedules = shares.flatMap((share) =>
    share.budgetItem ? [share.budgetItem] : [],
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface px-5 py-8 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-clay">
          {VENDOR_CATEGORY_LABELS[vendor.category]}
        </p>
        <h1 className="mt-3 font-display text-3xl text-ink">{wedding.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {formatLongDate(wedding.weddingDate)}
          {wedding.venueName && ` · ${wedding.venueName}`}
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          You are messaging as <strong className="text-ink">{vendor.name}</strong>
          {contactName && ` (${contactName})`}.
        </p>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-5 p-5 sm:p-8">
        {schedules.length > 0 && (
          <Card>
            <CardTitle>Payment dates</CardTitle>
            <p className="mb-3 text-sm text-ink-soft">
              Shared by the couple so you both work from the same schedule.
              Amounts are not included here — confirm those with them directly.
            </p>
            <ul className="space-y-4">
              {schedules.map((item) => (
                <li key={item.id}>
                  <p className="text-sm font-medium text-ink">{item.name}</p>
                  {item.payments.length === 0 ? (
                    <p className="mt-1 text-xs text-ink-faint">
                      No dates set yet.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {item.payments.map((payment) => (
                        <li
                          key={payment.id}
                          className="flex items-center justify-between gap-3 border-b border-line pb-1 text-sm last:border-0"
                        >
                          <span className="min-w-0 flex-1 text-ink">
                            {payment.label}
                          </span>
                          <span className="tabular text-ink-soft">
                            {payment.dueDate
                              ? formatDate(payment.dueDate)
                              : "No date set"}
                          </span>
                          <Badge tone={payment.paid ? "sage" : "neutral"}>
                            {payment.paid ? "Paid" : "Due"}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {moodBoards.map((board) => (
          <Card key={board.id}>
            <CardTitle>{board.title}</CardTitle>
            {board.items.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Nothing on the board yet.
              </p>
            ) : (
              <div className="columns-2 gap-4 sm:columns-3 [&>*]:mb-4">
                {board.items.map((item) => (
                  <MoodCard
                    key={item.id}
                    shareToken={token}
                    item={{
                      id: item.id,
                      category: item.category,
                      title: item.title,
                      note: item.note,
                      sourceUrl: item.sourceUrl,
                      uploadId: item.uploadId,
                      width: item.upload?.width ?? null,
                      height: item.upload?.height ?? null,
                    }}
                  />
                ))}
              </div>
            )}
          </Card>
        ))}

        <Card>
          <CardTitle>Messages</CardTitle>
          <MessageList messages={messages} viewer="VENDOR" shareToken={token} />

          <div className="mt-5 border-t border-line pt-4">
            <VendorReplyBox token={token} defaultName={contactName ?? ""} />
          </div>
        </Card>
      </main>

      <footer className="px-5 pb-10 text-center text-xs text-ink-faint">
        This link was sent to you by the couple. They can withdraw it at any time.
      </footer>
    </div>
  );
}
