import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "~/auth";
import { colors } from "~/theme";

/**
 * The launch gate.
 *
 * Nothing renders until the keychain has been read, so the app never shows the
 * sign-in screen for a frame to someone who is already signed in.
 */
export default function Index() {
  const { user, restoring } = useAuth();

  if (restoring) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  return <Redirect href={user ? "/weddings" : "/login"} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
});
