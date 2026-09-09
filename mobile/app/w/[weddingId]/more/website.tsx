import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatDayInZone, formatTimeInZone } from "@/lib/dates";
import { api, API_URL, errorMessage } from "~/api";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  ErrorMessage,
  StaleBanner,
} from "~/components/ui";
import { colors, radius, space, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen } from "~/workspace";

type SiteEvent = {
  id: string;
  name: string;
  startsAt: string;
  location: string | null;
  description: string | null;
};

type Payload = {
  site: {
    slug: string;
    headline: string | null;
    intro: string | null;
    publishedAt: string | null;
    template: string;
    events: SiteEvent[];
    registry: { id: string; label: string; url: string }[];
    galleryEnabled: boolean;
    guestBookEnabled: boolean;
  };
};

/**
 * The website, and the one switch that matters.
 *
 * Publishing is the single action with consequences a couple might want in a
 * hurry — the QR codes on the tables are dead until it is live — so it is the
 * one thing that is not read-only here. Writing the copy stays on the web app.
 */
export default function Website() {
  const weddingId = useWeddingId();
  const { workspace, screen, refreshAll, canEdit } = useWorkspaceScreen<Payload>(
    `/api/weddings/${weddingId}/site`,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const site = screen.data?.site;
  const timezone = workspace.data?.wedding.timezone ?? "UTC";
  const editable = canEdit("WEBSITE");
  const live = Boolean(site?.publishedAt);
  const url = site ? `${API_URL}/wedding/${site.slug}` : null;

  async function togglePublish() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/weddings/${weddingId}/site/publish`, {
        method: "POST",
        body: { published: !live },
      });
      await screen.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (screen.loading && !site) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

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

      <Card>
        <CardTitle
          action={<Badge tone={live ? "sage" : "neutral"}>{live ? "Live" : "Draft"}</Badge>}
        >
          {site?.headline || "Your wedding website"}
        </CardTitle>

        {url ? (
          <Text
            style={styles.link}
            onPress={() => void Linking.openURL(url)}
            accessibilityRole="link"
          >
            {url}
          </Text>
        ) : null}

        {site?.intro ? <Text style={styles.intro}>{site.intro}</Text> : null}

        {editable ? (
          <Button
            variant={live ? "secondary" : "primary"}
            label={live ? "Take it offline" : "Publish the site"}
            busy={busy}
            onPress={togglePublish}
            style={styles.publish}
          />
        ) : null}

        <Text style={styles.note}>
          {live
            ? "Guests can reach this now, along with the photo gallery and guest book if those are on."
            : "Nothing guest-facing works until this is live — the gallery, the guest book and every QR code go through it."}
        </Text>
      </Card>

      {site?.events && site.events.length > 0 ? (
        <Card>
          <CardTitle>Schedule</CardTitle>
          {site.events.map((event, index) => (
            <View
              key={event.id}
              style={[styles.event, index > 0 && styles.divided]}
            >
              <Text style={styles.eventName}>{event.name}</Text>
              <Text style={styles.eventMeta}>
                {formatDayInZone(event.startsAt, timezone)} ·{" "}
                {formatTimeInZone(event.startsAt, timezone)}
                {event.location ? ` · ${event.location}` : ""}
              </Text>
              {event.description ? (
                <Text style={styles.eventBody}>{event.description}</Text>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      {site?.registry && site.registry.length > 0 ? (
        <Card>
          <CardTitle>Registry</CardTitle>
          {site.registry.map((entry, index) => (
            <Text
              key={entry.id}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(entry.url)}
              style={[styles.link, index > 0 && styles.spaced]}
            >
              {entry.label}
            </Text>
          ))}
        </Card>
      ) : null}

      <Text style={styles.footer}>
        Headline, story, travel notes and registry links are edited on the web
        app.
      </Text>
    </ScrollView>
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
  link: { ...type.body, color: colors.clayDark, textDecorationLine: "underline" },
  spaced: { marginTop: space.sm },
  intro: { ...type.body, color: colors.inkSoft, marginTop: space.sm },
  publish: { marginTop: space.lg },
  note: { ...type.caption, color: colors.inkFaint, marginTop: space.md },
  event: { paddingVertical: space.sm, gap: 2 },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  eventName: { ...type.label, color: colors.ink },
  eventMeta: { ...type.caption, color: colors.inkFaint },
  eventBody: { ...type.caption, color: colors.inkSoft, marginTop: 2 },
  footer: { ...type.caption, color: colors.inkFaint, textAlign: "center" },
});
