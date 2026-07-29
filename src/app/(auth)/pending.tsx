import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import PhotoBackground from "@/components/ui/PhotoBackground";
import { frenchAuthMessage } from "@/lib/auth/authErrors";
import { useSession } from "@/lib/data/useSession";
import { alertDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { tokens } from "@/theme/tokens";

export default function PendingScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useSession();
  const router = useRouter();

  const signingOut = useAsyncAction(
    async () => {
      await signOut();
      router.replace("/(auth)/signin");
    },
    {
      mapError: frenchAuthMessage,
      onError: (message) => alertDialog("Déconnexion impossible", message),
    },
  );

  return (
    <PhotoBackground>
      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.card}>
          <Text style={styles.title}>Compte en attente de validation</Text>
          <Text style={styles.body}>
            Votre inscription a bien été reçue. Un membre de l’équipe Bike-eco doit
            valider votre compte avant que vous puissiez accéder à votre tableau de bord.
          </Text>
          <Button
            label="Se déconnecter"
            variant="outlined"
            loading={signingOut.pending}
            onPress={() => void signingOut.run()}
          />
        </View>
      </View>
    </PhotoBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: tokens.space.lg },
  card: {
    width: "100%", maxWidth: 420, gap: tokens.space.md, padding: tokens.space.lg,
    borderRadius: tokens.radius.lg, backgroundColor: tokens.colors.surface,
  },
  title: { ...tokens.text.title, textAlign: "center" },
  body: { ...tokens.text.subtitle, textAlign: "center" },
});
