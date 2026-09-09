import type { Metadata } from "next";
import {
  CelebrationsBoard,
  type CelebrationSettings,
} from "@/components/celebrations-board";
import { NoAccess } from "@/components/no-access";
import { canChange, canSee, loadWorkspace } from "@/lib/page";
import {
  loadGalleryForCouple,
  loadGuestBookForCouple,
} from "@/lib/services/celebrations";
import { qrSvg } from "@/lib/services/qr";
import { ensureSite } from "@/lib/services/site";

export const metadata: Metadata = { title: "Celebrations" };

export default async function CelebrationsPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { access } = await loadWorkspace(weddingId);

  // Guest contributions live under the wedding website, so they follow its access.
  if (!canSee(access, "WEBSITE")) {
    return <NoAccess section="Guest photos and messages" />;
  }

  const site = await ensureSite(weddingId);
  const [photos, entries] = await Promise.all([
    loadGalleryForCouple(weddingId),
    loadGuestBookForCouple(weddingId),
  ]);

  const base = process.env.APP_URL ?? "http://localhost:3000";
  const published = site.publishedAt !== null;
  const galleryUrl =
    published && site.galleryEnabled ? `${base}/wedding/${site.slug}/gallery` : null;
  const guestBookUrl =
    published && site.guestBookEnabled
      ? `${base}/wedding/${site.slug}/guestbook`
      : null;

  const settings: CelebrationSettings = {
    published,
    slug: site.slug,
    galleryEnabled: site.galleryEnabled,
    galleryNote: site.galleryNote,
    guestBookEnabled: site.guestBookEnabled,
    guestBookNote: site.guestBookNote,
    moderateGuestPosts: site.moderateGuestPosts,
  };

  return (
    <CelebrationsBoard
      weddingId={weddingId}
      canEdit={canChange(access, "WEBSITE")}
      settings={settings}
      galleryUrl={galleryUrl}
      guestBookUrl={guestBookUrl}
      galleryQr={galleryUrl ? await qrSvg(galleryUrl) : null}
      photos={photos.map((photo) => ({
        id: photo.id,
        uploadId: photo.upload.id,
        caption: photo.caption,
        uploaderName: photo.uploaderName,
        approvedAt: photo.approvedAt?.toISOString() ?? null,
        hiddenAt: photo.hiddenAt?.toISOString() ?? null,
        createdAt: photo.createdAt.toISOString(),
        width: photo.upload.width,
        height: photo.upload.height,
      }))}
      entries={entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        guestName: entry.guestName,
        message: entry.message,
        uploadId: entry.upload?.id ?? null,
        approvedAt: entry.approvedAt?.toISOString() ?? null,
        hiddenAt: entry.hiddenAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
      }))}
    />
  );
}
