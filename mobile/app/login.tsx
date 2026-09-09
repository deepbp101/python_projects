import { Redirect } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "~/api";
import { useAuth } from "~/auth";
import { Button, ErrorMessage } from "~/components/ui";
import { colors, radius, space, type } from "~/theme";

export default function Login() {
  const { user, signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href="/weddings" />;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "in") {
        await signIn(email.trim(), password);
      } else {
        await signUp(name.trim(), email.trim(), password);
      }
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  const signingUp = mode === "up";

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>WEDDING PLANNER</Text>
        <Text style={styles.heading}>
          {signingUp ? "Start planning" : "Welcome back"}
        </Text>

        <View style={styles.form}>
          {signingUp ? (
            <Field
              label="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              textContentType="name"
            />
          ) : null}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            // Tells the keychain to offer the saved password, and on sign-up to
            // offer to generate and save a strong one.
            textContentType={signingUp ? "newPassword" : "password"}
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          <ErrorMessage>{error}</ErrorMessage>

          <Button
            label={signingUp ? "Create account" : "Sign in"}
            busy={busy}
            onPress={submit}
            disabled={!email.trim() || !password || (signingUp && !name.trim())}
          />

          <Button
            variant="ghost"
            label={
              signingUp
                ? "I already have an account"
                : "I need to create an account"
            }
            onPress={() => {
              setMode(signingUp ? "in" : "up");
              setError(null);
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={label}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: space.xl, gap: space.sm },
  eyebrow: {
    ...type.caption,
    color: colors.clay,
    letterSpacing: 2,
    fontWeight: "600",
  },
  heading: { ...type.display, color: colors.ink, marginTop: space.sm },
  form: { marginTop: space.xxl, gap: space.lg },
  field: { gap: space.xs },
  fieldLabel: { ...type.label, color: colors.inkSoft },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    ...type.body,
    color: colors.ink,
  },
});
