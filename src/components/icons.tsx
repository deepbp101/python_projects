import type { SVGProps } from "react";

/**
 * The workspace icon set.
 *
 * Hand-drawn on one grid rather than pulled from a library: the app has fifteen
 * runtime dependencies and an icon pack would be the largest of them, for eleven
 * glyphs. They replace a row of typographic dingbats (◆ ✓ $ ♥ ✦ ▦ …) that came
 * from different type designers at different weights and could never be made to
 * align or read as a family.
 *
 * Rules that keep them a set: a 24×24 box, 1.5 stroke on `currentColor`, round
 * caps and joins, no fills, and shapes that stay legible at 20px. Size comes from
 * the class name so a caller can scale one without it drifting off the grid.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Dashboard — a house, the one shape everyone reads as "start here". */
export const HomeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1h-4v-5.5h-7V20h-4a1 1 0 0 1-1-1z" />
  </Icon>
);

/** Checklist — a list with one item ticked. */
export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7.5 5.5 9 8 6" />
    <path d="M4 16.5 5.5 18 8 15" />
    <path d="M11 7.5h9M11 16.5h9" />
  </Icon>
);

/** Budget — a banknote, not a currency symbol, so it works outside dollars. */
export const BudgetIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </Icon>
);

/** Guest list — two people. */
export const GuestsIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.8" />
    <path d="M17.5 14.6a5.5 5.5 0 0 1 3 4.9" />
  </Icon>
);

/** Vendors — a shopfront awning. */
export const VendorsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" />
    <path d="M2.5 9.5 4.2 5a1 1 0 0 1 .9-.6h13.8a1 1 0 0 1 .9.6l1.7 4.5" />
    <path d="M2.5 9.5a3 3 0 0 0 4.75 0 3 3 0 0 0 4.75 0 3 3 0 0 0 4.75 0 3 3 0 0 0 4.75 0" />
  </Icon>
);

/**
 * Seating — one round table seen from above, with four chairs.
 *
 * An earlier version drew two tables with tick-mark chairs; at 20px the ticks
 * vanished and it read as two sparkles. One table with round chairs survives the
 * size, which is the only test an icon has to pass.
 */
export const SeatingIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="4.2" r="1.7" />
    <circle cx="12" cy="19.8" r="1.7" />
    <circle cx="4.2" cy="12" r="1.7" />
    <circle cx="19.8" cy="12" r="1.7" />
  </Icon>
);

/** Mood board — stacked images. */
export const MoodIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="7" y="3.5" width="13.5" height="13.5" rx="2" />
    <path d="m10.5 12.5 2.5-2.5 3 3 1.5-1.5 3 3" />
    <circle cx="12" cy="8" r="1.2" />
    <path d="M17 20.5H5.5a2 2 0 0 1-2-2V7" />
  </Icon>
);

/** Wedding website — a globe, the public-facing page. */
export const SiteIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17" />
  </Icon>
);

/** Celebrations — a camera: guest photos and the guest book. */
export const CelebrationsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 8.5h3l1.5-2.5h8L17.5 8.5h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Icon>
);

/** Assistant — a pen, for the writing help. */
export const AssistantIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M16.5 3.9a2 2 0 0 1 2.8 2.8L8.4 17.6l-3.9 1.1 1.1-3.9z" />
    <path d="m14.5 5.9 3.6 3.6" />
  </Icon>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0V20a1.6 1.6 0 0 0-2.7-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.4 13H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.4V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.4a2 2 0 1 1 0 4H21a1.6 1.6 0 0 0-1.5 1z" />
  </Icon>
);

/** "More" — the overflow menu on mobile. */
export const MoreIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);
