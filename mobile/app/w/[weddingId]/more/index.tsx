import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { WorkspaceSection } from "@/generated/prisma/enums";
import { useAuth } from "~/auth";
import { Button, Card } from "~/components/ui";
import { colors, radius, space, TAP, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen } from "~/workspace";

/**
 * Grouped the way the desktop nav is, because the grouping answers a real
 * question — "which of these is about the guests?" — that a flat list of six
 * makes you read all six to answer.
 */
const GROUPS: {
  heading: string;
  items: { slug: string; label: string; blurb: string; section: WorkspaceSection }[];
}[] = [
  {
    heading: "Planning",
    items: [
      {
        slug: "vendors",
        label: "Vendors",
        blurb: "Who you are talking to, and every thread",
        section: "VENDORS",
      },
    ],
  },
  {
    heading: "What guests see",
    items: [
      {
        slug: "website",
        label: "Wedding website",
        blurb: "The page guests get, and whether it is live",
        section: "WEBSITE",
      },
      {
        slug: "celebrations",
        label: "Photos & guest book",
        blurb: "Approve what guests have posted",
        section: "WEBSITE",
      },
    ],
  },
  {
    heading: "Ideas",
    items: [
      {
        slug: "moodboard",
        label: "Mood board",
        blurb: "The images you keep coming back to",
        section: "MOODBOARD",
      },
      {
        slug: "assistant",
        label: "Assistant",
        blurb: "Help with the writing, and a read on your style",
        section: "TASKS",
      },
    ],
  },
];

export default function More() {
  const weddingId = useWeddingId();
  const insets = useSafeAreaInsets();
  const { workspace } = useWorkspaceScreen<null>(null);
  const { user, signOut } = useAuth();

  const access = workspace.data?.access;
  const canSee = (section: WorkspaceSection) =>
    access ? access[section] !== "NONE" : true;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.lg, paddingBottom: space.xxl },
      ]}
    >
      <Text style={styles.heading}>More</Text>

      {GROUPS.map((group) => {
        // A section the collaborator cannot reach is not listed at all — the
        // routes refuse it independently, so this is tidiness rather than the
        // enforcement.
        const items = group.items.filter((item) => canSee(item.section));
        if (items.length === 0) return null;

        return (
          <View key={group.heading} style={styles.group}>
            <Text style={styles.groupHeading}>
              {group.heading.toUpperCase()}
            </Text>
            <Card style={styles.card}>
              {items.map((item, index) => (
                // asChild: a bare Link renders a Text, and nesting Views inside
                // one lays out wrongly on Android.
                <Link
                  key={item.slug}
                  href={`/w/${weddingId}/more/${item.slug}`}
                  asChild
                >
                  <Pressable
                    accessibilityRole="link"
                    style={({ pressed }) => [
                      styles.row,
                      index > 0 && styles.divided,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View style={styles.rowBody}>
                      <Text style={styles.rowLabel}>{item.label}</Text>
                      <Text style={styles.rowBlurb}>{item.blurb}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </Link>
              ))}
            </Card>
          </View>
        );
      })}

      <View style={styles.group}>
        <Text style={styles.groupHeading}>ACCOUNT</Text>
        <Card style={styles.card}>
          <Link href={`/w/${weddingId}/more/settings`} asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Settings & plan</Text>
                <Text style={styles.rowBlurb}>
                  Who can see what, and what you are on
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
        </Card>
      </View>

      <Text style={styles.signedIn}>
        Signed in as {user?.email ?? ""}
      </Text>
      <Button variant="secondary" label="Sign out" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: space.lg, gap: space.md },
  heading: { ...type.display, color: colors.ink },
  group: { gap: space.sm },
  groupHeading: {
    ...type.caption,
    color: colors.inkFaint,
    letterSpacing: 1.2,
    marginTop: space.sm,
  },
  card: { padding: 0 },
  row: {
    minHeight: TAP + 12,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  rowPressed: { backgroundColor: colors.surfaceSunk },
  rowBody: { flex: 1 },
  rowLabel: { ...type.body, color: colors.ink, fontWeight: "500" },
  rowBlurb: { ...type.caption, color: colors.inkFaint, marginTop: 2 },
  chevron: { ...type.title, color: colors.inkFaint },
  signedIn: {
    ...type.caption,
    color: colors.inkFaint,
    marginTop: space.lg,
    textAlign: "center",
  },
});
