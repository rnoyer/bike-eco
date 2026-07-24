import { Alert } from "react-native";
import { useRouter } from "expo-router";
import SettingsScreen from "@/components/screens/SettingsScreen";
import { useSession } from "@/lib/data/useSession";

export default function BackofficeSettings() {
  const router = useRouter();
  const { signOut } = useSession();
  return (
    <SettingsScreen
      role="backoffice"
      onManageCompanies={() => router.push("/(backoffice)/companies")}
      onInvite={() => Alert.alert("Inviter un collègue", "Action non disponible pour le moment.")}
      onDelete={() => Alert.alert("Supprimer son compte", "Action non disponible pour le moment.")}
      onSignOut={signOut}
    />
  );
}
