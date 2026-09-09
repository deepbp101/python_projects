import clsx from "clsx";
import {
  attachmentLabel,
  formatBytes,
  isImageAttachment,
  messageTimestamp,
  sideOf,
  type Side,
} from "@/lib/domain/messaging";

export type ThreadMessage = {
  id: string;
  authorId: string | null;
  /** Set for a vendor reply, which has no account behind it. */
  authorName: string | null;
  /** The collaborator's name, for messages from the couple's side. */
  accountName: string | null;
  body: string;
  createdAt: string;
  attachments: {
    id: string;
    uploadId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
  }[];
};

/**
 * The conversation, rendered the same way for both sides.
 *
 * `viewer` only decides which bubbles sit on the right — the content is identical,
 * because a vendor and a couple reading the same thread should be reading the same
 * thing. Timestamps are relative and computed at render, so they carry
 * `suppressHydrationWarning`: the server and the client will not agree on "3m ago"
 * and there is nothing wrong with that.
 */
export function MessageList({
  messages,
  viewer,
  shareToken,
}: {
  messages: ThreadMessage[];
  viewer: Side;
  shareToken?: string;
}) {
  if (messages.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-soft">
        No messages yet.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {messages.map((message) => {
        const side = sideOf(message);
        const mine = side === viewer;
        const who =
          side === "VENDOR"
            ? (message.authorName ?? "Vendor")
            : (message.accountName ?? "The couple");

        return (
          <li
            key={message.id}
            className={clsx("flex flex-col", mine ? "items-end" : "items-start")}
          >
            <div className="flex items-baseline gap-2 px-1">
              <span className="text-xs font-medium text-ink-soft">{who}</span>
              <span
                className="text-[11px] text-ink-faint"
                suppressHydrationWarning
              >
                {messageTimestamp(message.createdAt)}
              </span>
            </div>

            <div
              className={clsx(
                "mt-1 max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm sm:max-w-[70%]",
                mine
                  ? "bg-clay text-white"
                  : "border border-line bg-surface text-ink",
              )}
            >
              <p className="whitespace-pre-wrap break-words">{message.body}</p>

              {message.attachments.length > 0 && (
                <ul className="space-y-2">
                  {message.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <Attachment
                        attachment={attachment}
                        onDark={mine}
                        shareToken={shareToken}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Attachment({
  attachment,
  onDark,
  shareToken,
}: {
  attachment: ThreadMessage["attachments"][number];
  onDark: boolean;
  shareToken?: string;
}) {
  const href = `/api/files/${attachment.uploadId}${
    shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""
  }`;

  if (isImageAttachment(attachment.mimeType)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element -- served from our own access-checked route */}
        <img
          src={href}
          alt={attachment.originalName}
          width={attachment.width ?? undefined}
          height={attachment.height ?? undefined}
          loading="lazy"
          className="max-h-64 w-auto rounded-xl border border-black/5"
        />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-colors",
        onDark
          ? "bg-white/15 text-white hover:bg-white/25"
          : "bg-surface-sunk text-ink-soft hover:bg-line",
      )}
    >
      <span aria-hidden className="font-medium">
        {attachmentLabel(attachment.mimeType)}
      </span>
      <span className="min-w-0 flex-1 truncate">{attachment.originalName}</span>
      <span className="tabular shrink-0 opacity-70">
        {formatBytes(attachment.sizeBytes)}
      </span>
    </a>
  );
}
