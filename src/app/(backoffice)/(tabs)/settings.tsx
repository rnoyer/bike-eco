import SettingsScreen from "@/components/screens/SettingsScreen";
import { useRouter } from "expo-router";
import { Alert } from "react-native";

export default function BackofficeSettings() {
  const router = useRouter();
  return (
    <SettingsScreen
      role="backoffice"
      onManageCompanies={() => router.push("/(backoffice)/companies")}
      onInvite={() =>
        Alert.alert(
          "Inviter un collègue",
          "Action non disponible pour le moment.",
        )
      }
    />
  );
}
