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
        <aside className="border-b border-line bg-surface lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="px-5 py-4 lg:py-6">
            <Link
              href="/weddings"
              className="text-[11px] font-medium uppercase tracking-[0.2em] text-clay"
            >
              ← All weddings
            </Link>
            <h1 className="mt-2 font-display text-xl leading-snug text-ink">
              {wedding.title}
            </h1>
            <div className="mt-1 flex items-center gap-3">
              <CountdownWidget
                weddingDate={wedding.weddingDate.toISOString()}
                compact
              />
            </div>
            <div className="mt-2">
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
