import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatDate } from "@/lib/dates";
import { Card, CardTitle, EmptyState, ErrorMessage, StaleBanner } from "~/components/ui";
import { colors, radius, space, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen } from "~/workspace";
import { useCached } from "~/cache";

type Draft = {
  id: string;
  kind: string;
  title: string | null;
  content: string;
  createdAt: string;
};

type StyleProfile = {
  profile: {
    summary: string | null;
    themes: { name: string; score: number }[] | null;
    model: string | null;
    updatedAt: string | null;
  } | null;
};

/**
 * The assistant's output, read-only.
 *
 * Generating is a long-running request that wants the brief typed out — a
 * paragraph of context is not a phone job. What is a phone job is reading back
 * the vows you drafted on Tuesday while standing in a florist's, so that is
 * what this does.
 */
export default function Assistant() {
  const weddingId = useWeddingId();
  const { screen, refreshAll } = useWorkspaceScreen<{ drafts: Draft[] }>(
    `/api/weddings/${weddingId}/ai/drafts`,
  );
  const style = useCached<StyleProfile>(`/api/weddings/${weddingId}/style`);

  const drafts = screen.data?.drafts ?? [];
  const profile = style.data?.profile;

  if (screen.loading && drafts.length === 0) {
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
          onRefresh={() => {
            void refreshAll();
            void style.refresh();
          }}
          tintColor={colors.clay}
        />
      }
    >
      {screen.stale ? <StaleBanner fetchedAt={screen.fetchedAt} /> : null}
      <ErrorMessage>{screen.error}</ErrorMessage>

      {profile?.summary ? (
        <Card>
          <CardTitle>Your style</CardTitle>
          <Text style={styles.summary}>{profile.summary}</Text>
          {profile.themes && profile.themes.length > 0 ? (
            <View style={styles.themes}>
              {profile.themes.slice(0, 4).map((theme) => (
                <View key={theme.name} style={styles.theme}>
                  <Text style={styles.themeName}>{theme.name}</Text>
                  <View style={styles.themeTrack}>
                    <View
                      style={[
                        styles.themeFill,
                        { width: `${Math.max(0, Math.min(theme.score, 100))}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      <Text style={styles.sectionHeading}>Drafts</Text>

      {drafts.length === 0 ? (
        <EmptyState
          title="No drafts yet"
          description="Vows, speeches and thank-you notes written on the web app are saved here to read back."
        />
      ) : (
        drafts.map((draft) => (
          <Card key={draft.id} style={styles.draft}>
            <View style={styles.draftHead}>
              <Text style={styles.draftTitle}>
                {draft.title || draft.kind.toLowerCase()}
              </Text>
              <Text style={styles.draftDate}>{formatDate(draft.createdAt)}</Text>
            </View>
            <Text style={styles.draftBody}>{draft.content}</Text>
          </Card>
        ))
      )}

      <Text style={styles.footer}>
        Writing new drafts is on the web app — it wants a brief typed out, and a
        paragraph of context is not a phone job.
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
  summary: { ...type.body, color: colors.inkSoft },
  themes: { marginTop: space.lg, gap: space.sm },
  theme: { gap: space.xs },
  themeName: { ...type.caption, color: colors.inkSoft },
  themeTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunk,
    overflow: "hidden",
  },
  themeFill: { height: "100%", backgroundColor: colors.rose },
  sectionHeading: { ...type.title, color: colors.ink, marginTop: space.sm },
  draft: { gap: space.sm },
  draftHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.sm,
  },
  draftTitle: { ...type.label, color: colors.ink, textTransform: "capitalize" },
  draftDate: { ...type.caption, color: colors.inkFaint },
  draftBody: { ...type.body, color: colors.inkSoft, lineHeight: 22 },
  footer: { ...type.caption, color: colors.inkFaint, textAlign: "center" },
});
