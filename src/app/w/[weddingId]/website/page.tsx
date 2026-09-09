import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { WebsiteBuilder } from "@/components/website-builder";
import { canChange, canSee, loadWorkspace } from "@/lib/page";
import { ensureSite } from "@/lib/services/site";

export const metadata: Metadata = { title: "Wedding website" };

export default async function WebsitePage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { access } = await loadWorkspace(weddingId);

  if (!canSee(access, "WEBSITE")) return <NoAccess section="The wedding website" />;

  const site = await ensureSite(weddingId);

  return (
    <WebsiteBuilder
      weddingId={weddingId}
      canEdit={canChange(access, "WEBSITE")}
      site={{
        slug: site.slug,
        template: site.template,
        headline: site.headline,
        intro: site.intro,
        storyTitle: site.storyTitle,
        story: site.story,
        travelTitle: site.travelTitle,
        travel: site.travel,
        registryNote: site.registryNote,
        rsvpNote: site.rsvpNote,
        rsvpDeadline: site.rsvpDeadline
          ? site.rsvpDeadline.toISOString().slice(0, 10)
          : "",
        publishedAt: site.publishedAt ? site.publishedAt.toISOString() : null,
        coverUploadId: site.coverUploadId,
      }}
      events={site.events.map((event) => ({
        id: event.id,
        name: event.name,
        startsAt: event.startsAt.toISOString(),
        venueName: event.venueName,
        address: event.address,
        description: event.description,
        dressCode: event.dressCode,
      }))}
      registry={site.registry.map((link) => ({
        id: link.id,
        label: link.label,
        url: link.url,
        note: link.note,
      }))}
    />
  );
}
