/**
 * The web app's palette, transcribed.
 *
 * Deliberately the same hex values as `src/app/globals.css` rather than a
 * native-flavoured reinterpretation: a couple who plans on a laptop and checks
 * on a phone should not feel handed to a different product halfway through.
 * Names match the CSS custom properties one for one, so a change on either side
 * is easy to mirror.
 */
export const colors = {
  canvas: "#faf7f2",
  surface: "#ffffff",
  surfaceSunk: "#f4efe7",
  line: "#e7ded1",
  lineStrong: "#d6c9b6",

  ink: "#2f2a26",
  inkSoft: "#6c6259",
  inkFaint: "#9a9089",

  clay: "#b08968",
  clayDark: "#8c6e50",
  claySoft: "#f2e7db",

  sage: "#7d8471",
  sageSoft: "#eaeee5",

  rose: "#b9868b",
  roseSoft: "#f7e9ea",

  alert: "#b5652f",
  alertSoft: "#fbeade",
  danger: "#9d4040",
  dangerSoft: "#f8e4e4",
} as const;

/** A 4pt scale. Every gap and pad in the app comes from here. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/**
 * Type scale. The web app pairs a display serif with the system sans; on the
 * phone the display face is left to the platform serif, which is Times on iOS
 * and Noto Serif on Android — both close enough in feel, and neither costs a
 * font download on first launch.
 */
export const type = {
  display: { fontSize: 24, fontWeight: "600" as const, letterSpacing: -0.3 },
  title: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  label: { fontSize: 13, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
  stat: { fontSize: 26, fontWeight: "600" as const },
} as const;

/** Minimum tap target. Enforced on every pressable in the app. */
export const TAP = 44;
