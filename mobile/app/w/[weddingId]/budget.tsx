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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  Badge,
  Card,
  EmptyState,
  ErrorMessage,
  ProgressBar,
  StaleBanner,
  Stat,
} from "~/components/ui";
import { colors, radius, space, TAP, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen } from "~/workspace";

type Category = {
  id: string;
  name: string;
  color: string | null;
  plannedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  percentUsed: number;
  status: "OK" | "WARNING" | "OVER";
  itemCount: number;
};

type Reminder = {
  paymentId: string;
  itemName: string;
  label: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  isOverdue: boolean;
  vendorName: string | null;
};

type BudgetPayload = {
  summary: {
    totalBudget: number;
    totalPaid: number;
    totalOutstanding: number;
    remainingAmount: number;
    percentUsed: number;
    status: "OK" | "WARNING" | "OVER";
    categories: Category[];
  };
  reminders: Reminder[];
  currency: string;
};

const TONE = { OK: "clay", WARNING: "alert", OVER: "danger" } as const;

export default function Budget() {
  const weddingId = useWeddingId();
  const insets = useSafeAreaInsets();
  const { workspace, screen, refreshAll } = useWorkspaceScreen<BudgetPayload>(
    `/api/weddings/${weddingId}/budget`,
  );

  const [open, setOpen] = useState<string | null>(null);

  const payload = screen.data;
  const currency = payload?.currency ?? workspace.data?.wedding.currency ?? "USD";
  const summary = payload?.summary;
  const categories = summary?.categories ?? [];
  const reminders = payload?.reminders ?? [];

  if (screen.loading && !payload) {
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
          refreshing={screen.refreshing}
          onRefresh={() => void refreshAll()}
          tintColor={colors.clay}
        />
      }
    >
      {workspace.stale || screen.stale ? (
        <StaleBanner fetchedAt={screen.fetchedAt} />
      ) : null}
      <ErrorMessage>{screen.error}</ErrorMessage>

      <View>
        <Text style={styles.heading}>Budget</Text>
        <Text style={styles.sub}>
          {formatMoney(summary?.totalPaid ?? 0, currency)} spent of{" "}
          {formatMoney(summary?.totalBudget ?? 0, currency)}
        </Text>
      </View>

      {summary && (summary.totalBudget > 0 || categories.length > 0) ? (
        <Card>
          <View style={styles.statRow}>
            <Stat
              label="Budget"
              value={formatMoney(summary.totalBudget, currency)}
            />
            <Stat label="Paid" value={formatMoney(summary.totalPaid, currency)} />
          </View>
          <View style={styles.statRow}>
            <Stat
              label="Still owed"
              value={formatMoney(summary.totalOutstanding, currency)}
            />
            <Stat
              label="Left"
              value={formatMoney(summary.remainingAmount, currency)}
            />
          </View>
          <View style={styles.bar}>
            <ProgressBar value={summary.percentUsed} tone={TONE[summary.status]} />
          </View>
        </Card>
      ) : null}

      {reminders.length > 0 ? (
        <Card>
          <Text style={styles.cardHeading}>Payments coming up</Text>
          {reminders.slice(0, 6).map((reminder, index) => (
            <View
              key={reminder.paymentId}
              style={[styles.reminder, index > 0 && styles.divided]}
            >
              <View style={styles.flex}>
                <Text style={styles.reminderName} numberOfLines={1}>
                  {reminder.itemName}
                  {reminder.vendorName ? ` · ${reminder.vendorName}` : ""}
                </Text>
                <Text style={styles.reminderMeta}>
                  {reminder.label} · due {formatDate(reminder.dueDate)}
                </Text>
              </View>
              <View style={styles.reminderRight}>
                <Text style={styles.reminderAmount}>
                  {formatMoney(reminder.amount, currency)}
                </Text>
                <Badge tone={reminder.isOverdue ? "danger" : "alert"}>
                  {reminder.isOverdue
                    ? `${Math.abs(reminder.daysUntilDue)}d overdue`
                    : `in ${reminder.daysUntilDue}d`}
                </Badge>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {categories.length === 0 ? (
        <EmptyState
          title="No budget categories yet"
          description="Add categories like Venue, Catering and Photography on the web app, then track line items and payments under each."
        />
      ) : (
        categories.map((category) => {
          const isOpen = open === category.id;
          return (
            <Card key={category.id} style={styles.category}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                onPress={() => setOpen(isOpen ? null : category.id)}
                style={styles.categoryHead}
              >
                <View style={styles.flex}>
                  <View style={styles.categoryTitleRow}>
                    {category.color ? (
                      <View
                        style={[styles.swatch, { backgroundColor: category.color }]}
                      />
                    ) : null}
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {category.name}
                    </Text>
                    {category.status !== "OK" ? (
                      <Badge tone={category.status === "OVER" ? "danger" : "alert"}>
                        {`${category.percentUsed}%`}
                      </Badge>
                    ) : null}
                  </View>
                  {/* The whole point of collapsing: a shut category still
                      answers "is this one fine?" without being opened. */}
                  <Text style={styles.categoryMeta}>
                    {formatMoney(category.paidAmount, currency)} of{" "}
                    {formatMoney(category.plannedAmount, currency)} ·{" "}
                    {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
                  </Text>
                  <View style={styles.categoryBar}>
                    <ProgressBar
                      value={category.percentUsed}
                      tone={TONE[category.status]}
                    />
                  </View>
                </View>
                <Text style={styles.chevron}>{isOpen ? "▾" : "▸"}</Text>
              </Pressable>

              {isOpen ? (
                <View style={styles.detail}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Still owed</Text>
                    <Text style={styles.detailValue}>
                      {formatMoney(category.outstandingAmount, currency)}
                    </Text>
                  </View>
                  <Text style={styles.detailNote}>
                    Line items and payments are on the web app for now.
                  </Text>
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </ScrollView>
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
  flex: { flex: 1 },
  heading: { ...type.display, color: colors.ink },
  sub: { ...type.body, color: colors.inkSoft, marginTop: 2 },
  cardHeading: { ...type.title, color: colors.ink, marginBottom: space.sm },

  statRow: { flexDirection: "row", gap: space.lg, marginBottom: space.md },
  bar: { marginTop: space.xs },

  reminder: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  reminderName: { ...type.body, color: colors.ink },
  reminderMeta: { ...type.caption, color: colors.inkFaint, marginTop: 2 },
  reminderRight: { alignItems: "flex-end", gap: space.xs },
  reminderAmount: {
    ...type.label,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },

  category: { padding: space.md },
  categoryHead: {
    minHeight: TAP,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
  },
  categoryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  swatch: { width: 10, height: 10, borderRadius: radius.pill },
  categoryName: { ...type.label, color: colors.ink, flexShrink: 1 },
  categoryMeta: { ...type.caption, color: colors.inkSoft, marginTop: space.xs },
  categoryBar: { marginTop: space.sm },
  chevron: { ...type.body, color: colors.inkFaint, marginTop: 2 },

  detail: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: space.xs,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { ...type.body, color: colors.inkSoft },
  detailValue: {
    ...type.body,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  detailNote: { ...type.caption, color: colors.inkFaint },
});
