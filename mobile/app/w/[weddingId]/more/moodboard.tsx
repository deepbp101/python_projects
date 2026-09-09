import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { AuthedImage } from "~/components/authed-image";
import { Badge, EmptyState, ErrorMessage, StaleBanner } from "~/components/ui";
import { colors, radius, space, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen } from "~/workspace";

type Item = {
  id: string;
  category: string | null;
  note: string | null;
  sourceUrl: string | null;
  upload: { id: string; width: number | null; height: number | null } | null;
};

type Payload = { board: { title: string; items: Item[] } | null };

/**
 * The mood board, read-only on the phone.
 *
 * Two columns rather than a grid of squares: these are dresses and table
 * settings, and cropping a portrait photo to a square to make a tidy grid
 * throws away the thing being looked at. Heights follow each image's own
 * aspect ratio, which the API already reports.
 */
export default function MoodBoard() {
  const weddingId = useWeddingId();
  const { width } = useWindowDimensions();
  const { screen, refreshAll } = useWorkspaceScreen<Payload>(
    `/api/weddings/${weddingId}/moodboard`,
  );

  const items = screen.data?.board?.items ?? [];
  const columnWidth = (width - space.lg * 2 - space.sm) / 2;

  if (screen.loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  // Shortest-column-first, so two columns of differently sized images end at
  // roughly the same place instead of one trailing halfway down the screen.
  const columns: Item[][] = [[], []];
  const heights = [0, 0];
  for (const item of items) {
    const ratio =
      item.upload?.width && item.upload?.height
        ? item.upload.height / item.upload.width
        : 1.25;
    const target = heights[0] <= heights[1] ? 0 : 1;
    columns[target].push(item);
    heights[target] += columnWidth * ratio;
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
      <ErrorMessage>{screen.error}</ErrorMessage>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing pinned yet"
          description="Add the images you keep coming back to on the web app — dresses, florals, table settings."
        />
      ) : (
        <View style={styles.columns}>
          {columns.map((column, index) => (
            <View key={index} style={styles.column}>
              {column.map((item) => {
                const ratio =
                  item.upload?.width && item.upload?.height
                    ? item.upload.height / item.upload.width
                    : 1.25;
                return (
                  <View key={item.id} style={styles.item}>
                    {item.upload ? (
                      <AuthedImage
                        uploadId={item.upload.id}
                        style={{
                          width: columnWidth,
                          height: columnWidth * ratio,
                          borderRadius: radius.md,
                          backgroundColor: colors.surfaceSunk,
                        }}
                        accessibilityLabel={item.note ?? "Mood board image"}
                      />
                    ) : null}
                    {/* Badge hugs its text; in a column it would otherwise
                        stretch to the full width. */}
                    {item.category ? (
                      <View style={styles.badgeRow}>
                        <Badge tone="clay">{item.category}</Badge>
                      </View>
                    ) : null}
                    {item.note ? (
                      <Text style={styles.note}>{item.note}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
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
  columns: { flexDirection: "row", gap: space.sm },
  column: { flex: 1, gap: space.md },
  item: { gap: space.xs },
  badgeRow: { flexDirection: "row" },
  note: { ...type.caption, color: colors.inkSoft },
});
