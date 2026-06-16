import { type Href, Stack, useRouter } from "expo-router";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // TODO: build the garagiste/concessionnaire sign-in screen at src/app/signin.tsx.
  // Cast is required until that route exists, since typed routes only knows real files.
  const SIGNIN_ROUTE = "/signin" as Href;

  return (
    <>
      {/* No nav bar on the landing screen — same convention as formParticuliers. */}
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {/* Fake modal: a centered card, NOT a <Modal> component. */}
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>Qui êtes-vous&nbsp;?</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => router.push("/formParticuliers")}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Un particulier"
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>
                Un particulier
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => router.push(SIGNIN_ROUTE)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Un garagiste ou concessionnaire"
            >
              <Text style={styles.btnText}>Un garagiste/concessionnaire</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 17, 17, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 28,
    // Subtle elevation so it reads as a floating modal.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    textAlign: "center",
    marginBottom: 24,
  },
  actions: {
    gap: 12,
  },
  btn: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    backgroundColor: "#111",
  },
  btnSecondary: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  btnTextPrimary: {
    color: "#fff",
  },
});
