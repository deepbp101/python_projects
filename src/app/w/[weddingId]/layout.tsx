import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CountdownWidget } from "@/components/countdown-widget";
import { PresenceBar, RealtimeProvider } from "@/components/realtime-provider";
import { WorkspaceNav } from "@/components/workspace-nav";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resolveAllAccess } from "@/lib/permissions";

/**
 * Workspace shell. Membership is resolved once here and the resulting access
 * map drives which sections are even offered in the nav — the routes still
 * enforce it independently.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/w/${weddingId}/dashboard`);

  const collaborator = await prisma.collaborator.findFirst({
    where: { weddingId, userId: user.id, status: "ACTIVE" },
    include: { wedding: true, permissions: true },
  });
  if (!collaborator) notFound();

  const { wedding } = collaborator;
  const access = resolveAllAccess(collaborator.role, collaborator.permissions);

  return (
    <RealtimeProvider weddingId={wedding.id} userId={user.id}>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        {/*
          The same four facts, stacked in the desktop sidebar but folded onto one
          line on a phone. Stacked, they cost about a third of an 844px screen
          before any content — a masthead that big is a poster, not a header.
        */}
        <aside className="sticky top-0 z-20 border-b border-line bg-surface lg:static lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 px-4 py-2.5 lg:block lg:px-5 lg:py-6">
            <Link
              href="/weddings"
              aria-label="All weddings"
              className="shrink-0 text-[11px] font-medium uppercase tracking-[0.2em] text-clay"
            >
              <span aria-hidden className="lg:hidden">
                ←
              </span>
              <span className="hidden lg:inline">← All weddings</span>
            </Link>

            <div className="min-w-0 flex-1 lg:mt-2">
              <h1 className="truncate font-display text-base leading-snug text-ink lg:text-xl">
                {wedding.title}
              </h1>
              <div className="flex items-center gap-2 lg:mt-1">
                <CountdownWidget
                  weddingDate={wedding.weddingDate.toISOString()}
                  compact
                />
                <span aria-hidden className="text-ink-faint lg:hidden">
                  ·
                </span>
                <div className="lg:hidden">
                  <PresenceBar />
                </div>
              </div>
            </div>

            <div className="hidden lg:mt-2 lg:block">
              <PresenceBar />
            </div>
          </div>

          <WorkspaceNav
            weddingId={wedding.id}
            access={access}
            role={collaborator.role}
          />
        </aside>

        <div className="flex-1 pb-20 lg:pb-0">{children}</div>
      </div>
    </RealtimeProvider>
  );
}
