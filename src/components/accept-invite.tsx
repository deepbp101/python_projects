"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorMessage } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client/api";

export function AcceptInvite({
  token,
  userEmail,
}: {
  token: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ wedding: { id: string; title: string } }>(
        "/api/invites/accept",
        { method: "POST", body: { token } },
      );
      router.replace(`/w/${result.wedding.id}/dashboard`);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <Card>
        <h1 className="font-display text-2xl text-ink">
          You&rsquo;ve been invited
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Accepting will add <strong className="text-ink">{userEmail}</strong> to
          the wedding workspace.
        </p>

        <div className="mt-5 space-y-3">
          <ErrorMessage>{error}</ErrorMessage>
          <Button onClick={accept} disabled={busy} className="w-full">
            {busy ? "Joining…" : "Accept invite"}
          </Button>
          <Link
            href="/weddings"
            className="block text-center text-sm text-ink-soft underline underline-offset-2"
          >
            Not now
          </Link>
        </div>
      </Card>
    </main>
  );
}
