"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, ErrorMessage, Field, Input } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client/api";

/** Shared sign-in / sign-up form. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await apiFetch(isSignup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        body: isSignup ? { name, email, password } : { email, password },
      });
      // A full refresh so the new session cookie is picked up server-side.
      router.replace(next ?? "/weddings");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <Link
        href="/"
        className="text-xs font-medium uppercase tracking-[0.2em] text-clay"
      >
        Wedding Planner
      </Link>
      <h1 className="mt-4 font-display text-3xl text-ink">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {isSignup
          ? "You'll set up your wedding in a moment."
          : "Sign in to pick up where you left off."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {isSignup && (
          <Field label="Your name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              maxLength={120}
            />
          </Field>
        )}

        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </Field>

        <Field
          label="Password"
          hint={isSignup ? "At least 10 characters." : undefined}
        >
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 10 : undefined}
          />
        </Field>

        <ErrorMessage>{error}</ErrorMessage>

        <Button type="submit" disabled={busy} className="w-full py-2.5">
          {busy
            ? "One moment…"
            : isSignup
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-clay-dark underline underline-offset-2"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </main>
  );
}
