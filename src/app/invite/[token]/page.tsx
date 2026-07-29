import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AcceptInvite } from "@/components/accept-invite";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Join a wedding" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();

  // Sign in first, then come straight back to the same link.
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return <AcceptInvite token={token} userEmail={user.email} />;
}
