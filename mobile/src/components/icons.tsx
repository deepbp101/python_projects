import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * The three tab icons, redrawn from src/components/icons.tsx on the same 24px
 * grid at 1.5 stroke with no fills.
 *
 * Same geometry as the web set rather than a platform icon font: the two apps
 * sitting side by side on a couple's laptop and phone should look like one
 * product, and a tab bar of Material glyphs beside a hand-drawn web nav does
 * not.
 */

// ColorValue, not string: Tabs hands its icons a platform colour, which can be
// an opaque native reference rather than a hex literal.
type IconProps = { color: ColorValue; size?: number };

function Icon({ color, size = 24, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M3.5 10.5 12 4l8.5 6.5" />
      <Path d="M5.5 9.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
      <Path d="M10 20v-5h4v5" />
    </Icon>
  );
}

export function ChecklistIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="m3 7 2 2 3-3.5" />
      <Path d="m3 16 2 2 3-3.5" />
      <Path d="M11 7h10" />
      <Path d="M11 16.5h10" />
    </Icon>
  );
}

export function GuestsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx="9" cy="8" r="3.25" />
      <Path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <Path d="M16 5.4a3.25 3.25 0 0 1 0 5.2" />
      <Path d="M17.5 14.6a5.5 5.5 0 0 1 3 4.9" />
    </Icon>
  );
}

/** One round table with four chairs — the tick-mark version read as sparkles at 20px. */
export function SeatingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx="12" cy="12" r="4.5" />
      <Circle cx="12" cy="4" r="1.6" />
      <Circle cx="12" cy="20" r="1.6" />
      <Circle cx="4" cy="12" r="1.6" />
      <Circle cx="20" cy="12" r="1.6" />
    </Icon>
  );
}

export function BudgetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Rect x="2.5" y="6" width="19" height="12" rx="2" />
      <Circle cx="12" cy="12" r="2.5" />
      <Path d="M5.5 9.5v.01M18.5 14.5v.01" />
    </Icon>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx="5" cy="12" r="1.4" />
      <Circle cx="12" cy="12" r="1.4" />
      <Circle cx="19" cy="12" r="1.4" />
    </Icon>
  );
}
