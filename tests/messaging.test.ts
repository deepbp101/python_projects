import { describe, expect, it } from "vitest";
import {
  attachmentLabel,
  formatBytes,
  isImageAttachment,
  messageTimestamp,
  sideOf,
  sortThreads,
  unreadCount,
} from "@/lib/domain/messaging";

const at = (iso: string) => new Date(iso);

const fromCouple = (iso: string) => ({
  authorId: "user-1",
  createdAt: at(iso),
});
const fromVendor = (iso: string) => ({ authorId: null, createdAt: at(iso) });

describe("sideOf", () => {
  it("treats a message with no account behind it as the vendor's", () => {
    expect(sideOf({ authorId: null })).toBe("VENDOR");
    expect(sideOf({ authorId: "user-1" })).toBe("COUPLE");
  });
});

describe("unreadCount", () => {
  const messages = [
    fromCouple("2026-07-01T09:00:00Z"),
    fromVendor("2026-07-01T10:00:00Z"),
    fromVendor("2026-07-02T11:00:00Z"),
  ];

  it("counts only the other side's messages since the last read", () => {
    expect(unreadCount(messages, at("2026-07-01T09:30:00Z"), "COUPLE")).toBe(2);
    expect(unreadCount(messages, at("2026-07-02T12:00:00Z"), "COUPLE")).toBe(0);
  });

  it("never counts your own messages as unread", () => {
    expect(
      unreadCount(
        [fromCouple("2026-07-05T09:00:00Z")],
        at("2026-07-01T00:00:00Z"),
        "COUPLE",
      ),
    ).toBe(0);
  });

  it("counts everything from the other side when the thread was never opened", () => {
    expect(unreadCount(messages, null, "COUPLE")).toBe(2);
    expect(unreadCount(messages, null, "VENDOR")).toBe(1);
  });

  it("does not count a message that arrived exactly at the read time", () => {
    expect(unreadCount(messages, at("2026-07-01T10:00:00Z"), "COUPLE")).toBe(1);
  });
});

describe("sortThreads", () => {
  it("puts the most recent conversation first", () => {
    const sorted = sortThreads([
      { name: "Older", lastMessageAt: at("2026-06-01T00:00:00Z") },
      { name: "Newer", lastMessageAt: at("2026-07-01T00:00:00Z") },
    ]);
    expect(sorted.map((t) => t.name)).toEqual(["Newer", "Older"]);
  });

  it("sorts never-used threads to the bottom, by name", () => {
    const sorted = sortThreads([
      { name: "Zola", lastMessageAt: null },
      { name: "Active", lastMessageAt: at("2026-06-01T00:00:00Z") },
      { name: "Aster", lastMessageAt: null },
    ]);
    expect(sorted.map((t) => t.name)).toEqual(["Active", "Aster", "Zola"]);
  });
});

describe("messageTimestamp", () => {
  const now = at("2026-07-30T12:00:00Z");

  it("uses coarse relative units within the week", () => {
    expect(messageTimestamp(at("2026-07-30T11:59:40Z"), now)).toBe("just now");
    expect(messageTimestamp(at("2026-07-30T11:45:00Z"), now)).toBe("15m");
    expect(messageTimestamp(at("2026-07-30T09:00:00Z"), now)).toBe("3h");
    expect(messageTimestamp(at("2026-07-28T12:00:00Z"), now)).toBe("2d");
  });

  it("falls back to a date beyond a week", () => {
    expect(messageTimestamp(at("2026-06-12T12:00:00Z"), now)).toBe("Jun 12");
  });
});

describe("attachment helpers", () => {
  it("labels the types threads accept", () => {
    expect(attachmentLabel("application/pdf")).toBe("PDF");
    expect(attachmentLabel("image/png")).toBe("PNG");
    expect(attachmentLabel("application/zip")).toBe("File");
  });

  it("knows which attachments can be shown inline", () => {
    expect(isImageAttachment("image/jpeg")).toBe(true);
    expect(isImageAttachment("application/pdf")).toBe(false);
  });

  it("formats sizes the way a person would say them", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3_500_000)).toBe("3.3 MB");
  });
});
