import { type Href, Stack, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import PhotoBackground from "@/components/ui/PhotoBackground";
import { tokens } from "@/theme/tokens";

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const SIGNIN_ROUTE: Href = "/(auth)/signin";

  return (
    <>
      {/* No nav bar on the landing screen — same convention as b2cSubmissionForm. */}
      <Stack.Screen options={{ headerShown: false }} />

      <PhotoBackground>
        <View
          style={[
            styles.content,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          {/* Fake modal: a centered card, NOT a <Modal> component. */}
          <View style={styles.card} accessibilityRole="alert">
            <Text style={styles.title}>Qui êtes-vous&nbsp;?</Text>

            <View style={styles.actions}>
              <Button
                label="Un particulier"
                onPress={() => router.push("/b2cSubmissionForm")}
              />
              <Button
                label="Un garagiste/concessionnaire"
                accessibilityLabel="Un garagiste ou concessionnaire"
                variant="outlined"
                onPress={() => router.push(SIGNIN_ROUTE)}
              />
            </View>
          </View>
        </View>
      </PhotoBackground>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.xl,
    // Subtle elevation so it reads as a floating modal.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    ...tokens.text.title,
    textAlign: "center",
    marginBottom: tokens.space.lg,
  },
  actions: {
    gap: tokens.space.md,
  },
});
