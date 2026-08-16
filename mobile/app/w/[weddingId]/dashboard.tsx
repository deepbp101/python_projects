import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { countdownTo, formatLongDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { useCached } from "~/cache";
import {
  Card,
  CardTitle,
  ErrorMessage,
  ProgressBar,
  StaleBanner,
  Stat,
} from "~/components/ui";
import { colors, radius, space, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen, type Workspace } from "~/workspace";

type TasksPayload = {
  tasks: { id: string; title: string; dueDate: string | null; completedAt: string | null }[];
};

type BudgetPayload = {
  summary: {
    totalBudget: number;
    totalPaid: number;
    totalOutstanding: number;
    percentUsed: number;
    status: "OK" | "WARNING" | "OVER";
    categories: unknown[];
  };
  currency: string;
};

export default function Dashboard() {
  const weddingId = useWeddingId();
  const insets = useSafeAreaInsets();

  const { workspace, screen, presence, refreshAll } =
    useWorkspaceScreen<TasksPayload>(`/api/weddings/${weddingId}/tasks`);
  const budget = useCached<BudgetPayload>(`/api/weddings/${weddingId}/budget`);

  const wedding = workspace.data?.wedding;
  const tasks = screen.data?.tasks ?? [];

  const open = tasks.filter((task) => !task.completedAt);
  const done = tasks.length - open.length;
  const next = [...open]
    .filter((task) => task.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 5);

  const stale = workspace.stale || screen.stale;

  if (!wedding && workspace.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.lg, paddingBottom: space.xxl },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={screen.refreshing || workspace.refreshing}
          onRefresh={() => {
            void refreshAll();
            void budget.refresh();
          }}
          tintColor={colors.clay}
        />
      }
    >
      {stale ? <StaleBanner fetchedAt={workspace.fetchedAt} /> : null}
      <ErrorMessage>{workspace.error ?? screen.error}</ErrorMessage>

      <View>
        <Text style={styles.heading}>{wedding?.title ?? "Your wedding"}</Text>
        <Text style={styles.sub}>
          {wedding ? formatLongDate(new Date(wedding.weddingDate)) : ""}
          {wedding?.venueName ? ` · ${wedding.venueName}` : ""}
        </Text>
        {presence.viewers.length > 0 ? (
          <Text style={styles.presence}>
            {presence.viewers.map((v) => v.name.split(" ")[0]).join(", ")}{" "}
            {presence.viewers.length === 1 ? "is" : "are"} here too
          </Text>
        ) : null}
      </View>

      {wedding ? <Countdown date={new Date(wedding.weddingDate)} /> : null}

      <Card>
        <CardTitle>Checklist</CardTitle>
        <Stat
          label="Complete"
          value={
            tasks.length > 0 ? `${Math.round((done / tasks.length) * 100)}%` : "0%"
          }
          hint={`${done} of ${tasks.length} tasks`}
        />
        <View style={styles.bar}>
          <ProgressBar
            value={tasks.length > 0 ? (done / tasks.length) * 100 : 0}
            tone="sage"
          />
        </View>
        {next.length > 0 ? (
          <View style={styles.list}>
            {next.map((task) => (
              <View key={task.id} style={styles.listRow}>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {task.title}
                </Text>
                <Text style={styles.listMeta}>
                  {task.dueDate
                    ? formatLongDate(new Date(task.dueDate))
                    : ""}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <BudgetCard payload={budget.data} workspace={workspace.data} />
    </ScrollView>
  );
}

function BudgetCard({
  payload,
  workspace,
}: {
  payload: BudgetPayload | null;
  workspace: Workspace | null;
}) {
  const currency = payload?.currency ?? workspace?.wedding.currency ?? "USD";
  const summary = payload?.summary;

  return (
    <Card>
      <CardTitle>Budget</CardTitle>
      {/* Same call as the web dashboard: a couple who skipped the optional
          budget gets a prompt, not four confident zeros. */}
      {!summary || (summary.totalBudget === 0 && summary.categories.length === 0) ? (
        <Text style={styles.prompt}>
          No budget set yet. Set a total on the web app and we&rsquo;ll split it
          across the usual categories.
        </Text>
      ) : (
        <>
          <View style={styles.statRow}>
            <Stat
              label="Spent"
              value={formatMoney(summary.totalPaid, currency)}
              hint={`of ${formatMoney(summary.totalBudget, currency)}`}
            />
            <Stat
              label="Still owed"
              value={formatMoney(summary.totalOutstanding, currency)}
            />
          </View>
          <View style={styles.bar}>
            <ProgressBar
              value={summary.percentUsed}
              tone={
                summary.status === "OVER"
                  ? "danger"
                  : summary.status === "WARNING"
                    ? "alert"
                    : "clay"
              }
            />
          </View>
        </>
      )}
    </Card>
  );
}

/**
 * The live countdown, ticking on the phone the way it does in the browser.
 *
 * Seconds are dropped past a week out: a number that changes faster than you
 * can read it is decoration, and at 400 days it is also slightly absurd.
 */
function Countdown({ date }: { date: Date }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = countdownTo(date);
  if (remaining.hasPassed) {
    return (
      <View style={styles.countdown}>
        <Text style={styles.countdownLabel}>MARRIED</Text>
        <Text style={styles.countdownDate}>{formatLongDate(date)}</Text>
      </View>
    );
  }

  const units: [number, string][] =
    remaining.days > 7
      ? [
          [remaining.days, "DAYS"],
          [remaining.hours, "HOURS"],
          [remaining.minutes, "MINUTES"],
        ]
      : [
          [remaining.days, "DAYS"],
          [remaining.hours, "HOURS"],
          [remaining.minutes, "MINUTES"],
          [remaining.seconds, "SECONDS"],
        ];

  return (
    <View style={styles.countdown}>
      <Text style={styles.countdownLabel}>COUNTING DOWN TO</Text>
      <Text style={styles.countdownDate}>{formatLongDate(date)}</Text>
      <View style={styles.countdownRow}>
        {units.map(([value, label]) => (
          <View key={label} style={styles.unit}>
            <Text style={styles.unitValue}>{value}</Text>
            <Text style={styles.unitLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: space.lg, gap: space.md },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
  heading: { ...type.display, color: colors.ink },
  sub: { ...type.body, color: colors.inkSoft, marginTop: 2 },
  presence: { ...type.caption, color: colors.sage, marginTop: space.xs },

  countdown: {
    backgroundColor: colors.roseSoft,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: "center",
    gap: space.xs,
  },
  countdownLabel: { ...type.caption, color: colors.rose, letterSpacing: 1.4 },
  countdownDate: { ...type.title, color: colors.ink },
  countdownRow: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.sm,
    alignSelf: "stretch",
  },
  unit: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: "center",
  },
  unitValue: {
    ...type.stat,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  unitLabel: { ...type.caption, color: colors.inkFaint, letterSpacing: 0.6 },

  statRow: { flexDirection: "row", gap: space.lg },
  bar: { marginTop: space.md },
  prompt: { ...type.body, color: colors.inkSoft },
  list: { marginTop: space.lg, gap: space.sm },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.sm,
  },
  listTitle: { ...type.body, color: colors.ink, flexShrink: 1 },
  listMeta: { ...type.caption, color: colors.inkFaint },
});
