import SettingsScreen from "@/components/screens/SettingsScreen";
import { useRouter } from "expo-router";

export default function BackofficeSettings() {
  const router = useRouter();
  return (
    <SettingsScreen
      role="backoffice"
      onManageCompanies={() => router.push("/(backoffice)/companies")}
      onInvite={() => router.push("/(backoffice)/add-colleague")}
      onManageColleague={(uid) => router.push(`/(backoffice)/colleagues/${uid}`)}
    />
  );
}
