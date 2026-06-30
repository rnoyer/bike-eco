import { Alert } from "react-native";
import SettingsScreen from "@/components/screens/SettingsScreen";

export default function BackofficeSettings() {
  return (
    <SettingsScreen
      role="backoffice"
      onInvite={() =>
        Alert.alert("Inviter un collègue", "Action non disponible pour le moment.")
      }
      onDelete={() =>
        Alert.alert("Supprimer son compte", "Action non disponible pour le moment.")
      }
    />
  );
}
