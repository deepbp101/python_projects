"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ErrorMessage, Field, Input } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { UNLOCK_PREFIX } from "@/lib/domain/unlock";

/**
 * Redeeming a Pro unlock code.
 *
 * One field and one button: the couple were sent a code, and everything else
 * about it — spacing, dashes, the prefix, case — is the server's problem, not
 * something to make them get right. On success the page is refreshed rather than
 * patched, so every number in the panel comes back from the same place.
 */
export function PlanUnlock({ weddingId }: { weddingId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await apiFetch(`/api/weddings/${encodeURIComponent(weddingId)}/plan/unlock`, {
        method: "POST",
        body: { code },
      });
      setCode("");
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <Field
        label="Have an unlock code?"
        hint="One code unlocks Pro for this wedding, for good. Nothing renews."
      >
        <Input
          required
          value={code}
          maxLength={64}
          onChange={(event) => setCode(event.target.value)}
          placeholder={`${UNLOCK_PREFIX}-XXXX-XXXX-XXXX-XXXX`}
          autoComplete="off"
          spellCheck={false}
          className="tabular uppercase"
        />
      </Field>

      <ErrorMessage>{error}</ErrorMessage>

      <Button type="submit" disabled={busy || !code.trim()}>
        {busy ? "Checking…" : "Unlock Pro"}
      </Button>
    </form>
  );
}
