import type { Metadata } from "next";
import { PlanPanel } from "@/components/plan-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { WeddingSettings } from "@/components/wedding-settings";
import { prisma } from "@/lib/db";
import { loadWorkspace } from "@/lib/page";
import { canManageWorkspace, resolveAllAccess } from "@/lib/permissions";
import { loadPlanSummary } from "@/lib/services/plan";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { wedding, role } = await loadWorkspace(weddingId);
  const isOwner = canManageWorkspace(role);

  const collaborators = await prisma.collaborator.findMany({
    where: { weddingId, status: { not: "REMOVED" } },
    include: { permissions: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  const planSummary = await loadPlanSummary(weddingId);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-5 sm:p-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Settings</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {isOwner
              ? "Wedding details and who can see what."
              : "You can see these details but only the couple can change them."}
          </p>
        </div>
        <SignOutButton />
      </header>

      <WeddingSettings
        weddingId={weddingId}
        isOwner={isOwner}
        wedding={{
          title: wedding.title,
          weddingDate: wedding.weddingDate.toISOString().slice(0, 10),
          venueName: wedding.venueName,
          location: wedding.location,
          totalBudget: wedding.totalBudget,
          currency: wedding.currency,
        }}
        collaborators={collaborators.map((collaborator) => ({
          id: collaborator.id,
          email: collaborator.email,
          name: collaborator.name,
          role: collaborator.role,
          status: collaborator.status,
          access: resolveAllAccess(collaborator.role, collaborator.permissions),
        }))}
      />

      <PlanPanel weddingId={weddingId} isOwner={isOwner} {...planSummary} />
    </main>
  );
}
