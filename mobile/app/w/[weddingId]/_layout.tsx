import { Tabs } from "expo-router";
import { colors, space, type } from "~/theme";
import { BudgetIcon, ChecklistIcon, HomeIcon } from "~/components/icons";

/**
 * Three tabs, not eleven.
 *
 * The web nav learned this the hard way: eleven destinations across a phone
 * gave 32px targets with labels running together. Here the first build covers
 * the three screens a couple opens daily, and the rest arrive behind a "More"
 * tab rather than by squeezing the bar.
 */
export default function WorkspaceLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.clayDark,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { ...type.caption, marginBottom: space.xs },
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
    </Tabs>
  );
}
