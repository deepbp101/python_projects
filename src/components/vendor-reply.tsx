"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MessageComposer } from "@/components/message-composer";

/**
 * The vendor's reply box.
 *
 * A thin client wrapper so the vendor page itself can stay a server component —
 * all it adds is the refresh after sending, since a vendor has no realtime
 * connection to push new messages to them.
 */
export function VendorReplyBox({
  token,
  defaultName,
}: {
  token: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <MessageComposer
      endpoint={`/api/vendor-threads/${encodeURIComponent(token)}/messages`}
      askForName
      defaultName={defaultName}
      placeholder="Reply to the couple…"
      onSent={() => startTransition(() => router.refresh())}
    />
  );
}
