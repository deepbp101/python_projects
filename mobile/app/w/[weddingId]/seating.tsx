import { useMemo, useState } from "react";
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
import type { TableShape } from "@/generated/prisma/enums";
import type { GuestLike } from "@/lib/domain/rsvp";
import { isSeatable, TABLE_SHAPE_LABELS } from "@/lib/domain/seating";
import { api, errorMessage } from "~/api";
import {
  Badge,
  Card,
  EmptyState,
  ErrorMessage,
  StaleBanner,
  Stat,
} from "~/components/ui";
import { colors, radius, space, TAP, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen } from "~/workspace";
import { useCached } from "~/cache";

type TableOccupancy = {
  id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  seated: number;
  seatsLeft: number;
  isFull: boolean;
  isOverCapacity: boolean;
  guestIds: string[];
};

type SeatingPayload = {
  tables: { id: string; name: string; shape: TableShape; x: number; y: number }[];
  assignments: { guestId: string; tableId: string }[];
  summary: {
    tableCount: number;
    totalCapacity: number;
    seated: number;
    unseated: number;
    seatsAvailable: number;
    awaitingRsvp: number;
    tables: TableOccupancy[];
  };
};

// isSeatable() takes the shared GuestLike, so that is what this holds.
type GuestsPayload = { guests: GuestLike[] };

/**
 * Seating on a phone.
 *
 * The web chart is a drag-and-drop canvas. That is the wrong primitive here:
 * a table node small enough for six of them to fit a 390px screen is smaller
 * than a fingertip, and dragging one means covering it with your hand. So the
 * phone gets the half of the web interaction that was already touch-first —
 * tap a guest, then tap a table — over a list rather than a canvas. Positions
 * are still shown, and moving tables around the room stays on the web app,
 * which is where a floor plan is actually laid out.
 */
export default function Seating() {
  const weddingId = useWeddingId();
  const insets = useSafeAreaInsets();
  const { workspace, screen, refreshAll, canEdit } =
    useWorkspaceScreen<SeatingPayload>(`/api/weddings/${weddingId}/seating`);
  const guestsQuery = useCached<GuestsPayload>(
    `/api/weddings/${weddingId}/guests`,
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editable = canEdit("SEATING");
  const summary = screen.data?.summary;
  const tables = summary?.tables ?? [];
  const assignments = screen.data?.assignments ?? [];
  const guests = guestsQuery.data?.guests ?? [];

  const byId = useMemo(
    () => new Map(guests.map((guest) => [guest.id, guest])),
    [guests],
  );
  const nameOf = (id: string) => {
    const guest = byId.get(id);
    return guest ? `${guest.firstName} ${guest.lastName}` : "Someone";
  };

  const unseated = useMemo(() => {
    const seated = new Set(assignments.map((a) => a.guestId));
    return guests.filter((guest) => isSeatable(guest) && !seated.has(guest.id));
  }, [guests, assignments]);

  async function seat(guestId: string, tableId: string | null) {
    if (!editable) return;
    setBusy(true);
    setError(null);
    try {
      // PUT, not POST: the guest's seat is unique in the database, so seating
      // is an upsert rather than a new row each time.
      await api(`/api/weddings/${weddingId}/seating/assignments`, {
        method: "PUT",
        body: { guestId, tableId },
      });
      setSelected(null);
      await Promise.all([screen.refresh(), guestsQuery.refresh()]);
    } catch (caught) {
      // Capacity is enforced server-side, so a full table refuses here rather
      // than being prevented in the UI and drifting out of step with the rule.
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (screen.loading && !summary) {
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
          onRefresh={() => {
            void refreshAll();
            void guestsQuery.refresh();
          }}
          tintColor={colors.clay}
        />
      }
    >
      {workspace.stale || screen.stale ? (
        <StaleBanner fetchedAt={screen.fetchedAt} />
      ) : null}
      <ErrorMessage>{error ?? screen.error}</ErrorMessage>

      <View>
        <Text style={styles.heading}>Seating</Text>
        <Text style={styles.sub}>
          {summary?.seated ?? 0} seated · {summary?.unseated ?? 0} to place ·{" "}
          {summary?.seatsAvailable ?? 0} seats free
        </Text>
      </View>

      {tables.length === 0 ? (
        <EmptyState
          title="No tables yet"
          description="Lay the room out on the web app — dragging tables around a floor plan wants a bigger screen. Once they exist, you can seat people from here."
        />
      ) : (
        <>
          <Card>
            <View style={styles.statRow}>
              <Stat label="Tables" value={summary?.tableCount ?? 0} />
              <Stat label="Seats" value={summary?.totalCapacity ?? 0} />
            </View>
            <View style={styles.statRow}>
              <Stat label="Seated" value={summary?.seated ?? 0} />
              <Stat
                label="To place"
                value={summary?.unseated ?? 0}
                hint={
                  summary?.awaitingRsvp
                    ? `${summary.awaitingRsvp} still to reply`
                    : undefined
                }
              />
            </View>
          </Card>

          {/* The instruction only exists while it is actionable. */}
          {selected ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                Seating {nameOf(selected)} — choose a table
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelected(null)}
                style={styles.bannerCancel}
              >
                <Text style={styles.bannerCancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}

          {!editable ? (
            <Text style={styles.readonly}>You have view-only access here.</Text>
          ) : null}

          {tables.map((table) => {
            const targetable = selected !== null && !table.isFull;
            return (
              <Card
                key={table.id}
                style={[styles.table, targetable && styles.tableTarget]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    targetable
                      ? `Seat ${nameOf(selected!)} at ${table.name}`
                      : `${table.name}, ${table.seated} of ${table.capacity} seats taken`
                  }
                  disabled={!targetable || busy}
                  onPress={() => void seat(selected!, table.id)}
                  style={styles.tableHead}
                >
                  <View style={styles.flex}>
                    <View style={styles.tableTitleRow}>
                      <Text style={styles.tableName}>{table.name}</Text>
                      {/* The default head table is named after its shape, so
                          the label would read "Head table  Head table". */}
                      {TABLE_SHAPE_LABELS[table.shape] !== table.name ? (
                        <Text style={styles.tableShape}>
                          {TABLE_SHAPE_LABELS[table.shape]}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.tableMeta}>
                      {table.seated} of {table.capacity} seats
                      {table.seatsLeft > 0
                        ? ` · ${table.seatsLeft} free`
                        : " · full"}
                    </Text>
                  </View>
                  {table.isOverCapacity ? (
                    <Badge tone="danger">Over</Badge>
                  ) : table.isFull ? (
                    <Badge tone="neutral">Full</Badge>
                  ) : targetable ? (
                    <Badge tone="clay">Seat here</Badge>
                  ) : null}
                </Pressable>

                {table.guestIds.length > 0 ? (
                  <View style={styles.seatedList}>
                    {table.guestIds.map((guestId) => (
                      <View key={guestId} style={styles.seatedRow}>
                        <Text style={styles.seatedName} numberOfLines={1}>
                          {nameOf(guestId)}
                        </Text>
                        {editable ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Unseat ${nameOf(guestId)}`}
                            disabled={busy}
                            onPress={() => void seat(guestId, null)}
                            style={styles.unseat}
                          >
                            <Text style={styles.unseatText}>Remove</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            );
          })}

          <Card>
            <Text style={styles.cardHeading}>
              Still to seat ({unseated.length})
            </Text>
            {unseated.length === 0 ? (
              <Text style={styles.prompt}>
                {summary?.awaitingRsvp
                  ? `Everyone who has accepted has a seat. ${summary.awaitingRsvp} still to reply.`
                  : "Everyone who has accepted has a seat."}
              </Text>
            ) : (
              <View style={styles.chips}>
                {unseated.map((guest) => {
                  const active = selected === guest.id;
                  return (
                    <Pressable
                      key={guest.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      disabled={!editable || busy}
                      onPress={() => setSelected(active ? null : guest.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {guest.firstName} {guest.lastName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>
        </>
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
  readonly: { ...type.caption, color: colors.inkFaint },
  cardHeading: { ...type.title, color: colors.ink, marginBottom: space.sm },
  prompt: { ...type.body, color: colors.inkSoft },

  statRow: { flexDirection: "row", gap: space.lg, marginBottom: space.md },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.claySoft,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  bannerText: { ...type.label, color: colors.clayDark, flex: 1 },
  bannerCancel: { minHeight: 32, justifyContent: "center", paddingHorizontal: space.sm },
  bannerCancelText: { ...type.label, color: colors.clayDark },

  table: { padding: space.md },
  tableTarget: { borderColor: colors.clay },
  tableHead: {
    minHeight: TAP,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  tableTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.sm,
  },
  tableName: { ...type.label, color: colors.ink },
  tableShape: { ...type.caption, color: colors.inkFaint },
  tableMeta: { ...type.caption, color: colors.inkSoft, marginTop: 2 },

  seatedList: {
    marginTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  seatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
  },
  seatedName: { ...type.body, color: colors.ink, flex: 1 },
  unseat: {
    minHeight: TAP,
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  unseatText: { ...type.caption, color: colors.danger },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunk,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.clay, borderColor: colors.clay },
  chipText: { ...type.label, color: colors.inkSoft },
  chipTextActive: { color: "#ffffff" },
});
