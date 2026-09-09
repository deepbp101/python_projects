import { Redirect, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { countdownTo, formatLongDate } from "@/lib/dates";
import { useAuth } from "~/auth";
import { useCached } from "~/cache";
import { Button, EmptyState, ErrorMessage, StaleBanner } from "~/components/ui";
import { colors, radius, space, TAP, type } from "~/theme";

type WeddingSummary = {
  id: string;
  title: string;
  weddingDate: string;
  venueName: string | null;
  role: string;
  _count: { guests: number; tasks: number };
};

export default function Weddings() {
  const { user, restoring, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { data, stale, fetchedAt, loading, error } =
    useCached<{ weddings: WeddingSummary[] }>("/api/weddings");

  if (!restoring && !user) return <Redirect href="/login" />;

  const weddings = data?.weddings ?? [];

  // One wedding is the overwhelmingly common case, and a list of one is a
  // pointless tap. Straight through to it.
  if (!loading && weddings.length === 1) {
    return <Redirect href={`/w/${weddings[0].id}/dashboard`} />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>WEDDING PLANNER</Text>
          <Text style={styles.heading}>
            Hello, {user?.name.split(" ")[0] ?? "there"}
          </Text>
        </View>
        <Button variant="ghost" label="Sign out" onPress={signOut} />
      </View>

      {stale ? <StaleBanner fetchedAt={fetchedAt} /> : null}
      <ErrorMessage>{error}</ErrorMessage>

      {loading && weddings.length === 0 ? (
        <ActivityIndicator color={colors.clay} style={styles.spinner} />
      ) : weddings.length === 0 ? (
        <EmptyState
          title="No weddings yet"
          description="Create one on the web app and it will appear here."
        />
      ) : (
        weddings.map((wedding) => {
          const remaining = countdownTo(new Date(wedding.weddingDate));
          return (
            <Pressable
              key={wedding.id}
              accessibilityRole="button"
              onPress={() => router.push(`/w/${wedding.id}/dashboard`)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>{wedding.title}</Text>
                <Text style={styles.rowCount}>
                  {remaining.hasPassed
                    ? "Married"
                    : `${remaining.days} days to go`}
                </Text>
              </View>
              <Text style={styles.rowMeta}>
                {formatLongDate(new Date(wedding.weddingDate))}
                {wedding.venueName ? ` · ${wedding.venueName}` : ""}
              </Text>
              <Text style={styles.rowFaint}>
                {wedding._count.guests} guests · {wedding._count.tasks} tasks
              </Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: space.xl, gap: space.md },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    marginBottom: space.md,
  },
  eyebrow: {
    ...type.caption,
    color: colors.clay,
    letterSpacing: 2,
    fontWeight: "600",
  },
  heading: { ...type.display, color: colors.ink, marginTop: space.xs },
  spinner: { marginTop: space.xxl },
  row: {
    minHeight: TAP,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  rowPressed: { borderColor: colors.clay },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: space.sm,
  },
  rowTitle: { ...type.title, color: colors.ink, flexShrink: 1 },
  rowCount: { ...type.label, color: colors.inkSoft, fontVariant: ["tabular-nums"] },
  rowMeta: { ...type.body, color: colors.inkSoft },
  rowFaint: { ...type.caption, color: colors.inkFaint },
});
