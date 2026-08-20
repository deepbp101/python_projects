import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GUEST_BOOK_KIND_LABELS } from "@/lib/domain/contributions";
import { formatDate } from "@/lib/dates";
import type { GuestBookKind } from "@/generated/prisma/enums";
import { api, errorMessage } from "~/api";
import { AuthedImage } from "~/components/authed-image";
import {
  Badge,
  Card,
  EmptyState,
  ErrorMessage,
  StaleBanner,
} from "~/components/ui";
import { colors, radius, space, TAP, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen } from "~/workspace";

type Photo = {
  id: string;
  caption: string | null;
  uploaderName: string | null;
  approvedAt: string | null;
  hiddenAt: string | null;
  createdAt: string;
  upload: { id: string; width: number | null; height: number | null };
};

type Entry = {
  id: string;
  kind: GuestBookKind;
  guestName: string;
  message: string | null;
  approvedAt: string | null;
  hiddenAt: string | null;
  createdAt: string;
  upload: { id: string; mimeType: string } | null;
};

type Payload = {
  photos: Photo[];
  entries: Entry[];
  site: {
    slug: string;
    publishedAt: string | null;
    galleryEnabled: boolean;
    guestBookEnabled: boolean;
    moderateGuestPosts: boolean;
  };
};

/**
 * Moderating what guests posted.
 *
 * This is the one screen where a phone genuinely beats a laptop: approving
 * photos happens in gaps — in a taxi, over coffee — and it is a two-state
 * decision per item. So the whole screen is one queue and two buttons.
 */
export default function Celebrations() {
  const weddingId = useWeddingId();
  const { screen, refreshAll, canEdit } = useWorkspaceScreen<Payload>(
    `/api/weddings/${weddingId}/celebrations`,
  );

  const [tab, setTab] = useState<"photos" | "book">("photos");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editable = canEdit("WEBSITE");
  const data = screen.data;
  const photos = data?.photos ?? [];
  const entries = data?.entries ?? [];

  const waiting = (item: { approvedAt: string | null; hiddenAt: string | null }) =>
    item.approvedAt === null && item.hiddenAt === null;

  async function moderate(
    kind: "gallery" | "guestbook",
    id: string,
    body: Record<string, boolean>,
  ) {
    if (!editable) return;
    setBusy(id);
    setError(null);
    try {
      await api(`/api/weddings/${weddingId}/${kind}/${id}`, {
        method: "PATCH",
        body,
      });
      await screen.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  if (screen.loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  const pendingPhotos = photos.filter(waiting).length;
  const pendingEntries = entries.filter(waiting).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={screen.refreshing}
          onRefresh={() => void refreshAll()}
          tintColor={colors.clay}
        />
      }
    >
      {screen.stale ? <StaleBanner fetchedAt={screen.fetchedAt} /> : null}
      <ErrorMessage>{error ?? screen.error}</ErrorMessage>

      {/* Says why the queue is empty before you wonder. */}
      {data && !data.site.publishedAt ? (
        <Card>
          <Text style={styles.notice}>
            Your wedding website isn&rsquo;t published yet. Guests reach the
            gallery and guest book through it, so nothing can arrive until it is
            live.
          </Text>
        </Card>
      ) : null}

      <View style={styles.tabs}>
        {(
          [
            ["photos", "Photos", photos.length, pendingPhotos],
            ["book", "Guest book", entries.length, pendingEntries],
          ] as const
        ).map(([key, label, total, pending]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {label} {total}
            </Text>
            {pending > 0 ? (
              <View style={styles.dot}>
                <Text style={styles.dotText}>{pending}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      {tab === "photos" ? (
        photos.length === 0 ? (
          <EmptyState
            title="No photos yet"
            description="Anything guests post from the QR code lands here for you to approve."
          />
        ) : (
          photos.map((photo) => (
            <Card key={photo.id} style={styles.item}>
              <AuthedImage
                uploadId={photo.upload.id}
                style={styles.photo}
                accessibilityLabel={photo.caption ?? "Guest photo"}
              />
              <View style={styles.itemBody}>
                <Text style={styles.itemName}>
                  {photo.uploaderName ?? "Someone"}
                </Text>
                {photo.caption ? (
                  <Text style={styles.itemText}>{photo.caption}</Text>
                ) : null}
                <Text style={styles.itemMeta}>{formatDate(photo.createdAt)}</Text>
              </View>
              <Moderation
                item={photo}
                busy={busy === photo.id}
                editable={editable}
                onApprove={() =>
                  void moderate("gallery", photo.id, { approved: true })
                }
                onHide={() =>
                  void moderate("gallery", photo.id, { hidden: true })
                }
              />
            </Card>
          ))
        )
      ) : entries.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Written notes, voice messages and short videos from guests land here."
        />
      ) : (
        entries.map((entry) => (
          <Card key={entry.id} style={styles.item}>
            <View style={styles.itemBody}>
              <View style={styles.entryHead}>
                <Text style={styles.itemName}>{entry.guestName}</Text>
                <Badge tone="neutral">
                  {GUEST_BOOK_KIND_LABELS[entry.kind]}
                </Badge>
              </View>
              {entry.message ? (
                <Text style={styles.itemText}>{entry.message}</Text>
              ) : null}
              {entry.upload && entry.kind !== "TEXT" ? (
                <Text style={styles.itemMeta}>
                  {entry.kind === "VOICE" ? "Voice message" : "Video"} — play it
                  on the web app
                </Text>
              ) : null}
              <Text style={styles.itemMeta}>{formatDate(entry.createdAt)}</Text>
            </View>
            <Moderation
              item={entry}
              busy={busy === entry.id}
              editable={editable}
              onApprove={() =>
                void moderate("guestbook", entry.id, { approved: true })
              }
              onHide={() =>
                void moderate("guestbook", entry.id, { hidden: true })
              }
            />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

/**
 * Approve and hide are independent flags, so this shows state rather than a
 * toggle: un-hiding must never silently re-approve something that was pulled.
 */
function Moderation({
  item,
  busy,
  editable,
  onApprove,
  onHide,
}: {
  item: { approvedAt: string | null; hiddenAt: string | null };
  busy: boolean;
  editable: boolean;
  onApprove: () => void;
  onHide: () => void;
}) {
  const state = item.hiddenAt
    ? "hidden"
    : item.approvedAt
      ? "live"
      : "waiting";

  return (
    <View style={styles.moderation}>
      <Badge
        tone={state === "live" ? "sage" : state === "hidden" ? "danger" : "alert"}
      >
        {state === "live" ? "Live" : state === "hidden" ? "Hidden" : "Waiting"}
      </Badge>
      {editable ? (
        <View style={styles.actions}>
          {state !== "live" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Approve"
              disabled={busy}
              onPress={onApprove}
              style={styles.action}
            >
              <Text style={styles.approve}>{busy ? "…" : "Approve"}</Text>
            </Pressable>
          ) : null}
          {state !== "hidden" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hide"
              disabled={busy}
              onPress={onHide}
              style={styles.action}
            >
              <Text style={styles.hide}>Hide</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
  notice: { ...type.body, color: colors.inkSoft },

  tabs: { flexDirection: "row", gap: space.sm },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 38,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { ...type.label, color: colors.inkSoft },
  tabTextActive: { color: colors.canvas },
  dot: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.alert,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: { ...type.caption, color: "#fff", fontSize: 11 },

  item: { padding: space.md, gap: space.sm },
  photo: {
    width: "100%",
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunk,
  },
  itemBody: { gap: 2 },
  entryHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  itemName: { ...type.label, color: colors.ink },
  itemText: { ...type.body, color: colors.inkSoft },
  itemMeta: { ...type.caption, color: colors.inkFaint },

  moderation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: space.sm,
  },
  actions: { flexDirection: "row", gap: space.sm },
  action: {
    minHeight: TAP,
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  approve: { ...type.label, color: colors.sage },
  hide: { ...type.label, color: colors.danger },
});
