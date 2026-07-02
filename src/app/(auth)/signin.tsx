import { type Href, useRouter } from "expo-router";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SignInFields from "@/components/form/SignInFields";
import PhotoBackground from "@/components/ui/PhotoBackground";
import ThirdPartyAuthButtons from "@/components/ui/ThirdPartyAuthButtons";
import { useSession } from "@/lib/data/useSession";
import { tokens } from "@/theme/tokens";

const DASHBOARDS: Record<"b2b" | "backoffice", Href> = {
  b2b: "/(b2b)/(tabs)/dashboard",
  backoffice: "/(backoffice)/(tabs)/dashboard",
};

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role, setRole } = useSession();

  const goToDashboard = () => router.replace(DASHBOARDS[role]);

  return (
    <PhotoBackground>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Bienvenue !</Text>
          <SignInFields onSubmit={goToDashboard} onForgotPassword={() => {}} />
          {/* TODO: route the selected provider into the real auth handler — the
              stub discards it and just navigates to the dashboard. */}
          <ThirdPartyAuthButtons onPress={goToDashboard} />

          {__DEV__ ? (
            <View style={styles.devRow}>
              <Text style={styles.devLabel}>DEV — rôle :</Text>
              <Text
                style={[styles.devChip, role === "b2b" && styles.devChipOn]}
                onPress={() => setRole("b2b")}
              >
                B2B
              </Text>
              <Text
                style={[styles.devChip, role === "backoffice" && styles.devChipOn]}
                onPress={() => setRole("backoffice")}
              >
                Back-office
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </PhotoBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.space.lg,
  },
  card: {
    gap: tokens.space.lg,
    padding: tokens.space.lg,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  title: { ...tokens.text.title, textAlign: "center" },
  devRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  devLabel: { fontSize: 12, color: tokens.colors.muted },
  devChip: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.divider,
    color: tokens.colors.primary,
  },
  devChipOn: { backgroundColor: tokens.colors.primary, color: "#fff" },
});
