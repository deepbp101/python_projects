import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Plan } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/dates";
import { planDefinition } from "@/lib/domain/plans";
import { Badge, Card, CardTitle, ErrorMessage, ProgressBar, StaleBanner } from "~/components/ui";
import { colors, space, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen } from "~/workspace";
import { useCached } from "~/cache";

type PlanPayload = {
  plan: Plan;
  unlockedAt: string | null;
  usage: { used: number; allowance: number; remaining: number; requests: number };
  counts: Record<string, number>;
};

type Collaborator = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
};

const COUNT_LABELS: Record<string, string> = {
  guests: "Guests",
  collaborators: "Collaborators",
  vendors: "Vendors",
  moodBoardItems: "Mood board images",
  galleryPhotos: "Guest photos",
  guestBookEntries: "Guest book entries",
  seatingTables: "Tables",
  aiDrafts: "Drafts",
};

export default function Settings() {
  const weddingId = useWeddingId();
  const { workspace, screen, refreshAll } = useWorkspaceScreen<PlanPayload>(
    `/api/weddings/${weddingId}/plan`,
  );
  const people = useCached<{ collaborators: Collaborator[] }>(
    `/api/weddings/${weddingId}/collaborators`,
  );

  const data = screen.data;
  const wedding = workspace.data?.wedding;
  const collaborators = people.data?.collaborators ?? [];

  if (screen.loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  const limits = data ? planDefinition(data.plan) : null;
  const usedPercent =
    data && data.usage.allowance > 0
      ? (data.usage.used / data.usage.allowance) * 100
      : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={screen.refreshing}
          onRefresh={() => {
            void refreshAll();
            void people.refresh();
          }}
          tintColor={colors.clay}
        />
      }
    >
      {screen.stale ? <StaleBanner fetchedAt={screen.fetchedAt} /> : null}
      <ErrorMessage>{screen.error}</ErrorMessage>

      <Card>
        <CardTitle>{wedding?.title ?? "This wedding"}</CardTitle>
        <Text style={styles.line}>
          {wedding ? formatDate(wedding.weddingDate) : ""}
          {wedding?.venueName ? ` · ${wedding.venueName}` : ""}
        </Text>
        <Text style={styles.line}>
          {wedding?.location ?? "No location set"} · {wedding?.timezone}
        </Text>
      </Card>

      <Card>
        <CardTitle
          action={
            <Badge tone={data?.plan === "PRO" ? "sage" : "neutral"}>
              {data ? planDefinition(data.plan).label : "—"}
            </Badge>
          }
        >
          Plan
        </CardTitle>
        {/* One-time unlock, so this says when — not when it renews, because it
            does not. */}
        <Text style={styles.line}>
          {data?.unlockedAt
            ? `Unlocked ${formatDate(data.unlockedAt)}. It does not expire.`
            : "Free plan. Pro is a one-time unlock for this wedding."}
        </Text>

        <View style={styles.usage}>
          <Text style={styles.usageLabel}>Assistant allowance</Text>
          <ProgressBar
            value={usedPercent}
            tone={usedPercent > 90 ? "danger" : usedPercent > 70 ? "alert" : "clay"}
          />
          <Text style={styles.usageMeta}>
            {data
              ? `${data.usage.remaining.toLocaleString()} of ${data.usage.allowance.toLocaleString()} left · ${data.usage.requests} generations so far`
              : ""}
          </Text>
          <Text style={styles.usageNote}>
            A pool for the whole wedding, not a monthly reset.
          </Text>
        </View>
      </Card>

      {data && limits ? (
        <Card>
          <CardTitle>Usage</CardTitle>
          {Object.entries(data.counts).map(([key, value], index) => {
            // Only shown when there is a cap to be near. On Pro almost
            // everything is uncapped, and a column of "25 of unlimited" is a
            // column of noise.
            const cap = limits.limits[key as keyof typeof limits.limits];
            const capped =
              typeof cap === "number" && Number.isFinite(cap) ? cap : null;
            return (
              <View
                key={key}
                style={[styles.row, index > 0 && styles.divided]}
              >
                <Text style={styles.rowLabel}>{COUNT_LABELS[key] ?? key}</Text>
                <Text style={styles.rowValue}>
                  {value}
                  {capped !== null ? ` of ${capped}` : ""}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <CardTitle>Who has access</CardTitle>
        {collaborators.map((person, index) => (
          <View
            key={person.id}
            style={[styles.row, index > 0 && styles.divided]}
          >
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>{person.name ?? person.email}</Text>
              <Text style={styles.rowMeta}>{person.email}</Text>
            </View>
            <Badge tone={person.status === "ACTIVE" ? "neutral" : "alert"}>
              {person.status === "ACTIVE"
                ? person.role.toLowerCase()
                : "invited"}
            </Badge>
          </View>
        ))}
      </Card>

      <Text style={styles.footer}>
        Inviting people, changing permissions and redeeming an unlock code are on
        the web app.
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
  flex: { flex: 1 },
  line: { ...type.body, color: colors.inkSoft, marginTop: 2 },
  usage: { marginTop: space.lg, gap: space.xs },
  usageLabel: { ...type.label, color: colors.ink },
  usageMeta: { ...type.caption, color: colors.inkSoft },
  usageNote: { ...type.caption, color: colors.inkFaint },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingVertical: space.sm,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  rowLabel: { ...type.body, color: colors.ink },
  rowMeta: { ...type.caption, color: colors.inkFaint },
  rowValue: {
    ...type.body,
    color: colors.inkSoft,
    fontVariant: ["tabular-nums"],
  },
  footer: { ...type.caption, color: colors.inkFaint, textAlign: "center" },
});
