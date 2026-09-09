/**
 * Thread maths: who has read what, and which conversation needs attention.
 * Pure, so both the workspace UI and the vendor-facing page can use it.
 */

export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

export type Side = "COUPLE" | "VENDOR";

/** A message is the vendor's when there is no user account behind it. */
export function sideOf(message: { authorId: string | null }): Side {
  return message.authorId === null ? "VENDOR" : "COUPLE";
}

/**
 * Messages the given side has not read yet.
 *
 * Only the *other* side's messages count — your own sent messages are never
 * unread. A null `readAt` means the side has never opened the thread, so
 * everything from the other side is unread.
 */
export function unreadCount(
  messages: { authorId: string | null; createdAt: Date | string }[],
  readAt: Date | string | null,
  viewer: Side,
): number {
  const since = readAt ? new Date(readAt).getTime() : null;

  return messages.filter((message) => {
    if (sideOf(message) === viewer) return false;
    if (since === null) return true;
    return new Date(message.createdAt).getTime() > since;
  }).length;
}

export type ThreadOrderable = {
  lastMessageAt: Date | string | null;
  name: string;
};

/**
 * Newest conversation first, with threads that have never been used sorted to
 * the bottom by name — a vendor you have not written to yet is not urgent.
 */
export function sortThreads<T extends ThreadOrderable>(threads: T[]): T[] {
  return [...threads].sort((a, b) => {
    if (!a.lastMessageAt && !b.lastMessageAt) {
      return a.name.localeCompare(b.name);
    }
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return (
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  });
}

const ATTACHMENT_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/gif": "GIF",
};

/** Human label for an attachment's type, for the chip on a non-image file. */
export function attachmentLabel(mimeType: string): string {
  return ATTACHMENT_LABELS[mimeType] ?? "File";
}

export function isImageAttachment(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/** Rough file size, rounded the way a person would say it. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Short relative time for message bubbles — "just now", "3h", "12 Jun".
 * Deliberately coarse: an exact timestamp is noise in a conversation.
 */
export function messageTimestamp(
  at: Date | string,
  now: Date = new Date(),
): string {
  const then = new Date(at);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}d`;

  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
