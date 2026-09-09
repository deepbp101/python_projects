import { Stack } from "expo-router";
import { colors, type } from "~/theme";

/**
 * The six screens that do not earn a tab.
 *
 * A stack rather than more tabs: these are visited occasionally and read more
 * than they are edited, so a menu and a back button costs nothing, while a
 * seventh tab would take width from the five that are used daily.
 */
export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.clayDark,
        headerTitleStyle: { ...type.title, color: colors.ink },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="vendors" options={{ title: "Vendors" }} />
      <Stack.Screen name="moodboard" options={{ title: "Mood board" }} />
      <Stack.Screen name="website" options={{ title: "Wedding website" }} />
      <Stack.Screen
        name="celebrations"
        options={{ title: "Photos & guest book" }}
      />
      <Stack.Screen name="assistant" options={{ title: "Assistant" }} />
      <Stack.Screen name="settings" options={{ title: "Settings & plan" }} />
    </Stack>
  );
}
