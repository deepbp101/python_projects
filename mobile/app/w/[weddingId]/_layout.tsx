import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space, type } from "~/theme";
import {
  BudgetIcon,
  ChecklistIcon,
  GuestsIcon,
  HomeIcon,
  SeatingIcon,
} from "~/components/icons";

/**
 * Five tabs, not eleven.
 *
 * The web nav learned this the hard way: eleven destinations across a phone
 * gave 32px targets with labels running together. Five is where this bar stops
 * — at 390px that is 78px per target, still comfortably past the 44px minimum.
 * The remaining six screens go behind a More sheet rather than a sixth tab.
 */
export default function WorkspaceLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.clayDark,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          // Sized explicitly rather than left to the default. Without the
          // inset the labels sit under the home indicator on a notched phone
          // and are clipped outright in a browser preview.
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: space.sm,
        },
        tabBarLabelStyle: { ...type.caption, marginTop: 2 },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="checklist"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color }) => <ChecklistIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: "Budget",
          tabBarIcon: ({ color }) => <BudgetIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="guests"
        options={{
          title: "Guests",
          tabBarIcon: ({ color }) => <GuestsIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="seating"
        options={{
          title: "Seating",
          tabBarIcon: ({ color }) => <SeatingIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
