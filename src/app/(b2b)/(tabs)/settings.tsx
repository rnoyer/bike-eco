import { useRouter } from "expo-router";
import { Alert } from "react-native";
import SettingsScreen from "@/components/screens/SettingsScreen";
import { useSession } from "@/lib/data/useSession";

export default function B2bSettings() {
  const router = useRouter();
  const { signOut } = useSession();
  return (
    <SettingsScreen
      role="b2b"
      onInvite={() => router.push("/(b2b)/add-colleague")}
      onDelete={() =>
        Alert.alert("Supprimer son compte", "Action non disponible pour le moment.")
      }
      onSignOut={signOut}
    />
  );
}
