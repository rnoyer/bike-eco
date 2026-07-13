import { Alert } from "react-native";
import SettingsScreen from "@/components/screens/SettingsScreen";
import { useSession } from "@/lib/data/useSession";

export default function BackofficeSettings() {
  const { signOut } = useSession();
  return (
    <SettingsScreen
      role="backoffice"
      onInvite={() =>
        Alert.alert("Inviter un collègue", "Action non disponible pour le moment.")
      }
      onDelete={() =>
        Alert.alert("Supprimer son compte", "Action non disponible pour le moment.")
      }
      onSignOut={signOut}
    />
  );
}
