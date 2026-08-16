import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewProps,
} from "react-native";
import { colors, radius, space, TAP, type } from "~/theme";

/** The native counterparts of src/components/ui.tsx, kept deliberately parallel. */

export function Card({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

export function CardTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.cardTitle}>
      <Text style={styles.cardTitleText}>{children}</Text>
      {action}
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  label,
  busy,
  disabled,
  style,
  ...props
}: PressableProps & {
  variant?: ButtonVariant;
  label: string;
  busy?: boolean;
}) {
  const isDisabled = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!busy }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        pressed && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style as object,
      ]}
      {...props}
    >
      {busy ? (
        <ActivityIndicator
          color={variant === "primary" ? "#fff" : colors.inkSoft}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "primary" && styles.buttonTextPrimary,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function ProgressBar({
  value,
  tone = "clay",
}: {
  value: number;
  tone?: "clay" | "sage" | "rose" | "alert" | "danger";
}) {
  const clamped = Math.max(0, Math.min(value, 100));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={styles.track}
    >
      <View
        style={[
          styles.fill,
          { width: `${clamped}%`, backgroundColor: colors[tone] },
        ]}
      />
    </View>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "sage" | "alert" | "danger" | "clay";
}) {
  const palette = {
    neutral: [colors.surfaceSunk, colors.inkSoft],
    sage: [colors.sageSoft, colors.sage],
    alert: [colors.alertSoft, colors.alert],
    danger: [colors.dangerSoft, colors.danger],
    clay: [colors.claySoft, colors.clayDark],
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Text style={[styles.badgeText, { color: palette[1] }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{description}</Text>
    </View>
  );
}

export function ErrorMessage({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <Text style={styles.errorText}>{children}</Text>
    </View>
  );
}

/**
 * The band that appears when the app is showing cached data it could not
 * refresh. Named rather than silent: numbers with no note beside them read as
 * current, and a stale budget total is exactly the kind of thing someone acts on.
 */
export function StaleBanner({ fetchedAt }: { fetchedAt: number | null }) {
  return (
    <View style={styles.stale}>
      <Text style={styles.staleText}>
        Offline — showing what was here{ago(fetchedAt)}.
      </Text>
    </View>
  );
}

function ago(at: number | null): string {
  if (!at) return "";
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return " a moment ago";
  if (minutes < 60) return ` ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return ` ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return ` ${days} day${days === 1 ? "" : "s"} ago`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },
  cardTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.md,
    gap: space.sm,
  },
  cardTitleText: { ...type.title, color: colors.ink },

  button: {
    minHeight: TAP,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: space.sm,
  },
  buttonPrimary: { backgroundColor: colors.clay },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  buttonGhost: { backgroundColor: "transparent" },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...type.label, color: colors.ink },
  buttonTextPrimary: { color: "#ffffff" },

  stat: { flex: 1, minWidth: 120 },
  statLabel: { ...type.caption, color: colors.inkFaint, letterSpacing: 0.6 },
  statValue: {
    ...type.stat,
    color: colors.ink,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  statHint: { ...type.caption, color: colors.inkSoft, marginTop: 2 },

  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunk,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radius.pill },

  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  badgeText: { ...type.caption, fontWeight: "500" },

  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.lineStrong,
    borderRadius: radius.lg,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    alignItems: "center",
    gap: space.xs,
  },
  emptyTitle: { ...type.title, color: colors.ink },
  emptyBody: {
    ...type.body,
    color: colors.inkSoft,
    textAlign: "center",
    maxWidth: 320,
  },

  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: space.md,
  },
  errorText: { ...type.body, color: colors.danger },

  stale: {
    backgroundColor: colors.alertSoft,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  staleText: { ...type.caption, color: colors.alert },
});
