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
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  Badge,
  Card,
  EmptyState,
  ErrorMessage,
  StaleBanner,
} from "~/components/ui";
import { colors, radius, space, TAP, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen } from "~/workspace";

type VendorStatus =
  | "RESEARCHING"
  | "CONTACTED"
  | "QUOTED"
  | "BOOKED"
  | "NOT_GOING_AHEAD";

type WeddingVendor = {
  id: string;
  status: VendorStatus;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  vendor: {
    id: string;
    name: string;
    category: string;
    city: string | null;
    priceTier: number | null;
  };
  budgetItem: { id: string; name: string; plannedAmount: number } | null;
  thread: {
    id: string;
    subject: string | null;
    lastMessageAt: string | null;
    messages: { id: string; body: string | null; createdAt: string }[];
  } | null;
};

const STATUS_LABELS: Record<VendorStatus, string> = {
  RESEARCHING: "Researching",
  CONTACTED: "Contacted",
  QUOTED: "Quoted",
  BOOKED: "Booked",
  NOT_GOING_AHEAD: "Not going ahead",
};

const STATUS_TONE: Record<VendorStatus, "neutral" | "clay" | "alert" | "sage" | "danger"> =
  {
    RESEARCHING: "neutral",
    CONTACTED: "clay",
    QUOTED: "alert",
    BOOKED: "sage",
    NOT_GOING_AHEAD: "danger",
  };

const ORDER: VendorStatus[] = [
  "BOOKED",
  "QUOTED",
  "CONTACTED",
  "RESEARCHING",
  "NOT_GOING_AHEAD",
];

export default function Vendors() {
  const weddingId = useWeddingId();
  const { workspace, screen, refreshAll } = useWorkspaceScreen<{
    vendors: WeddingVendor[];
  }>(`/api/weddings/${weddingId}/vendors`);

  const [open, setOpen] = useState<string | null>(null);

  const vendors = [...(screen.data?.vendors ?? [])].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status),
  );
  const currency = workspace.data?.wedding.currency ?? "USD";

  if (screen.loading && vendors.length === 0) {
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
      <ErrorMessage>{screen.error}</ErrorMessage>

      {vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          description="Add the people you are talking to on the web app — venue, photographer, florist — and their threads show up here."
        />
      ) : (
        vendors.map((entry) => {
          const isOpen = open === entry.id;
          const last = entry.thread?.messages?.[0];
          return (
            <Card key={entry.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                onPress={() => setOpen(isOpen ? null : entry.id)}
                style={styles.head}
              >
                <View style={styles.flex}>
                  <Text style={styles.name}>{entry.vendor.name}</Text>
                  <Text style={styles.meta}>
                    {[
                      entry.vendor.category,
                      entry.vendor.city,
                      entry.budgetItem
                        ? formatMoney(entry.budgetItem.plannedAmount, currency)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Badge tone={STATUS_TONE[entry.status]}>
                  {STATUS_LABELS[entry.status]}
                </Badge>
              </Pressable>

              {/* The one fact worth seeing without opening anything: whether
                  the ball is in your court. */}
              {last ? (
                <Text style={styles.lastMessage} numberOfLines={isOpen ? 0 : 2}>
                  {formatDate(last.createdAt)} — {last.body ?? "(attachment)"}
                </Text>
              ) : entry.thread ? (
                <Text style={styles.lastMessageFaint}>No messages yet</Text>
              ) : null}

              {isOpen ? (
                <View style={styles.detail}>
                  {entry.contactName || entry.contactEmail ? (
                    <Text style={styles.detailLine}>
                      {[entry.contactName, entry.contactEmail]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  ) : null}
                  {entry.notes ? (
                    <Text style={styles.detailLine}>{entry.notes}</Text>
                  ) : null}
                  <Text style={styles.detailNote}>
                    Replying, sharing files and quotes are on the web app —
                    threads carry attachments, and those want a bigger screen.
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
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
  flex: { flex: 1 },
  card: { padding: space.md, gap: space.sm },
  head: {
    minHeight: TAP,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  name: { ...type.label, color: colors.ink },
  meta: { ...type.caption, color: colors.inkFaint, marginTop: 2 },
  lastMessage: { ...type.caption, color: colors.inkSoft },
  lastMessageFaint: { ...type.caption, color: colors.inkFaint },
  detail: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: space.sm,
    gap: space.xs,
  },
  detailLine: { ...type.body, color: colors.inkSoft },
  detailNote: { ...type.caption, color: colors.inkFaint, marginTop: space.xs },
});
