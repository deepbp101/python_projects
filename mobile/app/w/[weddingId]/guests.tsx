import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RsvpStatus } from "@/generated/prisma/enums";
import {
  RSVP_STATUS_LABELS,
  statusOf,
  type GuestLike,
} from "@/lib/domain/rsvp";
import { api, errorMessage } from "~/api";
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

// Extends the shared GuestLike rather than restating it, so the screen cannot
// drift from what the domain helpers expect — that mismatch is a type error
// here rather than a wrong count at runtime.
type Guest = GuestLike & {
  household: { id: string; name: string } | null;
  // A join row, not the tag: the API returns GuestTagAssignment with the tag
  // nested. Flattening it here to `{ name }` would have been a lie the response
  // does not support.
  tags: { tagId: string; tag: { id: string; name: string; color: string | null } }[];
};

type GuestsPayload = {
  guests: Guest[];
  tags: { id: string; name: string; color: string | null }[];
  mealOptions: { id: string; name: string }[];
  counts: {
    totalInvited: number;
    attending: number;
    attendingAdults: number;
    attendingChildren: number;
    declined: number;
    responded: number;
    responseRate: number;
  };
};

const STATUS_TONE: Record<RsvpStatus, "sage" | "danger" | "alert" | "neutral"> = {
  ATTENDING: "sage",
  DECLINED: "danger",
  MAYBE: "alert",
  PENDING: "neutral",
};

const STATUS_CYCLE: RsvpStatus[] = ["PENDING", "ATTENDING", "MAYBE", "DECLINED"];

export default function Guests() {
  const weddingId = useWeddingId();
  const insets = useSafeAreaInsets();
  const { workspace, screen, refreshAll, canEdit } =
    useWorkspaceScreen<GuestsPayload>(`/api/weddings/${weddingId}/guests`);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RsvpStatus | "">("");
  const [pending, setPending] = useState<Record<string, RsvpStatus>>({});
  const [error, setError] = useState<string | null>(null);

  const guests = screen.data?.guests ?? [];
  const counts = screen.data?.counts;
  const editable = canEdit("GUESTS");

  // Same call as the web guest list: before the first guest exists, the
  // summary and the filters are reporting on nothing, so they stay away.
  const hasGuests = guests.length > 0;

  const statusFor = (guest: Guest): RsvpStatus =>
    pending[guest.id] ?? statusOf(guest);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return guests.filter((guest) => {
      if (statusFilter && statusFor(guest) !== statusFilter) return false;
      if (!needle) return true;
      return (
        `${guest.firstName} ${guest.lastName}`.toLowerCase().includes(needle) ||
        (guest.household?.name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [guests, search, statusFilter, pending]);

  /**
   * Tapping a guest's status advances it.
   *
   * A dropdown per row is four taps and a scroll wheel on a phone; there are
   * only four states and the common move is Pending → Attending, so the tap
   * cycles. The label always says where it is, so nothing is guessed.
   */
  async function cycleStatus(guest: Guest) {
    if (!editable) return;
    const current = statusFor(guest);
    const next =
      STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];

    setPending((state) => ({ ...state, [guest.id]: next }));
    setError(null);
    try {
      await api(`/api/weddings/${weddingId}/guests/${guest.id}/rsvp`, {
        method: "PUT",
        body: { status: next, mealOptionId: guest.rsvp?.mealOptionId ?? null },
      });
      await screen.refresh();
      setPending((state) => {
        const { [guest.id]: _done, ...rest } = state;
        return rest;
      });
    } catch (caught) {
      setPending((state) => {
        const { [guest.id]: _reverted, ...rest } = state;
        return rest;
      });
      setError(errorMessage(caught));
    }
  }

  if (screen.loading && !hasGuests) {
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
      keyboardShouldPersistTaps="handled"
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
      <ErrorMessage>{error ?? screen.error}</ErrorMessage>

      <View>
        <Text style={styles.heading}>Guest list</Text>
        <Text style={styles.sub}>
          {counts?.totalInvited ?? 0} invited · {counts?.attending ?? 0}{" "}
          attending
        </Text>
      </View>

      {hasGuests && counts ? (
        <>
          <Card>
            <View style={styles.statRow}>
              <Stat label="Invited" value={counts.totalInvited} />
              <Stat
                label="Attending"
                value={counts.attending}
                hint={`${counts.attendingAdults} adults · ${counts.attendingChildren} children`}
              />
            </View>
            <View style={styles.statRow}>
              <Stat label="Declined" value={counts.declined} />
              <Stat
                label="Responded"
                value={`${counts.responseRate}%`}
                hint={`${counts.responded} of ${counts.totalInvited}`}
              />
            </View>
            <ProgressBar value={counts.responseRate} tone="rose" />
          </Card>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search guests"
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Search guests"
            autoCorrect={false}
            style={styles.input}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {(["", ...STATUS_CYCLE] as (RsvpStatus | "")[]).map((option) => {
              const count =
                option === ""
                  ? guests.length
                  : guests.filter((guest) => statusFor(guest) === option).length;
              const active = statusFilter === option;
              return (
                <Pressable
                  key={option || "all"}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  disabled={count === 0}
                  onPress={() => setStatusFilter(option)}
                  style={[
                    styles.chip,
                    active && styles.chipActive,
                    count === 0 && styles.chipDisabled,
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option === "" ? "Everyone" : RSVP_STATUS_LABELS[option]} {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {!editable ? (
        <Text style={styles.readonly}>You have view-only access here.</Text>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title={hasGuests ? "No matches" : "No guests yet"}
          description={
            hasGuests
              ? "Try a different search or filter."
              : "Add guests on the web app — the phone is for checking and updating them."
          }
        />
      ) : (
        <Card style={styles.list}>
          {visible.map((guest, index) => {
            const status = statusFor(guest);
            return (
              <View
                key={guest.id}
                style={[styles.row, index > 0 && styles.divided]}
              >
                <View style={styles.flex}>
                  <Text style={styles.name}>
                    {guest.firstName} {guest.lastName}
                  </Text>
                  <Text style={styles.meta}>
                    {[
                      guest.household?.name,
                      guest.ageGroup !== "ADULT"
                        ? guest.ageGroup.toLowerCase()
                        : null,
                      ...guest.tags.map((assignment) => assignment.tag.name),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No group"}
                  </Text>
                  {guest.dietaryRestrictions ? (
                    <Text style={styles.diet}>
                      Dietary: {guest.dietaryRestrictions}
                    </Text>
                  ) : null}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${guest.firstName} ${guest.lastName}, RSVP ${RSVP_STATUS_LABELS[status]}`}
                  accessibilityHint={editable ? "Changes the reply" : undefined}
                  disabled={!editable}
                  onPress={() => void cycleStatus(guest)}
                  style={styles.statusTarget}
                >
                  <Badge tone={STATUS_TONE[status]}>
                    {RSVP_STATUS_LABELS[status]}
                  </Badge>
                </Pressable>
              </View>
            );
          })}
        </Card>
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

  statRow: { flexDirection: "row", gap: space.lg, marginBottom: space.md },
  input: {
    minHeight: TAP,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    ...type.body,
    color: colors.ink,
  },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipDisabled: { opacity: 0.45 },
  chipText: { ...type.label, color: colors.inkSoft },
  chipTextActive: { color: colors.canvas },

  list: { padding: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  name: { ...type.body, color: colors.ink },
  meta: { ...type.caption, color: colors.inkFaint, marginTop: 2 },
  diet: { ...type.caption, color: colors.alert, marginTop: 2 },
  // The badge is small; the target around it is not.
  statusTarget: {
    minHeight: TAP,
    minWidth: TAP,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
