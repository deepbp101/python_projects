import { useEffect, useMemo, useState } from "react";
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
import { api, errorMessage } from "~/api";
import { formatDate } from "@/lib/dates";
import { MILESTONE_LABELS, MILESTONE_ORDER } from "@/lib/domain/timeline";
import type { Milestone } from "@/generated/prisma/enums";
import {
  Badge,
  Card,
  EmptyState,
  ErrorMessage,
  ProgressBar,
  StaleBanner,
} from "~/components/ui";
import { colors, radius, space, TAP, type } from "~/theme";
import { useWeddingId, useWorkspaceScreen } from "~/workspace";

type Task = {
  id: string;
  title: string;
  description: string | null;
  milestone: Milestone;
  dueDate: string | null;
  completedAt: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
};

export default function Checklist() {
  const weddingId = useWeddingId();
  const insets = useSafeAreaInsets();
  const { workspace, screen, refreshAll, canEdit } = useWorkspaceScreen<{
    tasks: Task[];
  }>(`/api/weddings/${weddingId}/tasks`);

  // Optimistic ticks, keyed by task id. A checkbox that waits for a round trip
  // feels broken on a phone, where the round trip may be a second on hotel wifi.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  // null = nobody has chosen, so the default rule below applies. "none" is a
  // deliberate collapse, which must not fall back to opening something else.
  const [open, setOpen] = useState<Milestone | "none" | null>(null);

  const tasks = screen.data?.tasks ?? [];
  const editable = canEdit("TASKS");

  const isDone = (task: Task) => pending[task.id] ?? task.completedAt !== null;

  const groups = useMemo(() => {
    const byMilestone = MILESTONE_ORDER.map((milestone) => {
      const inGroup = tasks.filter((task) => task.milestone === milestone);
      const overdue = inGroup.filter(
        (task) =>
          !isDone(task) && task.dueDate && new Date(task.dueDate) < new Date(),
      ).length;
      return { milestone, tasks: inGroup, overdue };
    }).filter((group) => group.tasks.length > 0);
    return byMilestone;
  }, [tasks, pending]);

  // Same rule as the web checklist, including its day-one case: open where
  // something is late, and otherwise open the first group rather than handing
  // someone a stack of shut drawers.
  //
  // Applied once, when the tasks first arrive, rather than on every render.
  // Recomputing it live meant ticking the last overdue task in a group dropped
  // its overdue count to zero and slammed the group shut under the finger that
  // just tapped it.
  useEffect(() => {
    if (open !== null || groups.length === 0) return;
    setOpen(groups.find((group) => group.overdue > 0)?.milestone ?? groups[0].milestone);
  }, [groups, open]);

  const expanded = open;

  const done = tasks.filter(isDone).length;

  async function toggle(task: Task) {
    if (!editable) return;
    const next = !isDone(task);
    setPending((current) => ({ ...current, [task.id]: next }));
    setError(null);
    try {
      await api(`/api/weddings/${weddingId}/tasks/${task.id}`, {
        method: "PATCH",
        body: { completed: next },
      });
      await screen.refresh();
      setPending((current) => {
        const { [task.id]: _dropped, ...rest } = current;
        return rest;
      });
    } catch (caught) {
      // Put the checkbox back where it was; a tick that silently did nothing is
      // worse than one that visibly bounces.
      setPending((current) => {
        const { [task.id]: _dropped, ...rest } = current;
        return rest;
      });
      setError(errorMessage(caught));
    }
  }

  if (screen.loading && tasks.length === 0) {
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
      <ErrorMessage>{error ?? screen.error}</ErrorMessage>

      <View>
        <Text style={styles.heading}>Checklist</Text>
        <Text style={styles.sub}>
          {done} of {tasks.length} done
        </Text>
      </View>
      <ProgressBar
        value={tasks.length > 0 ? (done / tasks.length) * 100 : 0}
        tone="sage"
      />

      {!editable ? (
        <Text style={styles.readonly}>You have view-only access here.</Text>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Your checklist is built from the wedding date on the web app."
        />
      ) : (
        groups.map((group) => {
          const isOpen = expanded === group.milestone;
          return (
            <Card key={group.milestone} style={styles.group}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                onPress={() => setOpen(isOpen ? "none" : group.milestone)}
                style={styles.groupHead}
              >
                <Text style={styles.groupTitle}>
                  {MILESTONE_LABELS[group.milestone]}
                </Text>
                <Text style={styles.groupCount}>{group.tasks.length}</Text>
                {group.overdue > 0 ? (
                  <Badge tone="danger">{`${group.overdue} overdue`}</Badge>
                ) : null}
                <Text style={styles.chevron}>{isOpen ? "▾" : "▸"}</Text>
              </Pressable>

              {isOpen
                ? group.tasks.map((task, index) => (
                    <Pressable
                      key={task.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isDone(task) }}
                      accessibilityLabel={task.title}
                      disabled={!editable}
                      onPress={() => void toggle(task)}
                      style={[styles.task, index > 0 && styles.taskDivided]}
                    >
                      <View
                        style={[styles.box, isDone(task) && styles.boxChecked]}
                      >
                        {isDone(task) ? <Text style={styles.tick}>✓</Text> : null}
                      </View>
                      <View style={styles.taskBody}>
                        <Text
                          style={[
                            styles.taskTitle,
                            isDone(task) && styles.taskTitleDone,
                          ]}
                        >
                          {task.title}
                        </Text>
                        {task.description ? (
                          <Text style={styles.taskDesc}>{task.description}</Text>
                        ) : null}
                        {task.dueDate ? (
                          <Text style={styles.taskMeta}>
                            Due {formatDate(task.dueDate)}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                : null}
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
  heading: { ...type.display, color: colors.ink },
  sub: { ...type.body, color: colors.inkSoft, marginTop: 2 },
  readonly: { ...type.caption, color: colors.inkFaint },

  group: { padding: space.md },
  groupHead: {
    minHeight: TAP,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  groupTitle: { ...type.label, color: colors.ink, flexShrink: 1 },
  groupCount: { ...type.caption, color: colors.inkFaint },
  chevron: { ...type.body, color: colors.inkFaint, marginLeft: "auto" },

  task: { flexDirection: "row", gap: space.md, paddingVertical: space.md },
  taskDivided: { borderTopWidth: 1, borderTopColor: colors.line },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  boxChecked: { backgroundColor: colors.sage, borderColor: colors.sage },
  tick: { color: "#fff", fontSize: 14, lineHeight: 16 },
  taskBody: { flex: 1, gap: 2 },
  taskTitle: { ...type.body, color: colors.ink },
  taskTitleDone: { color: colors.inkFaint, textDecorationLine: "line-through" },
  taskDesc: { ...type.caption, color: colors.inkSoft },
  taskMeta: { ...type.caption, color: colors.inkFaint },
});
