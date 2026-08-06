import SettingsScreen from "@/components/screens/SettingsScreen";
import { useRouter } from "expo-router";

export default function B2bSettings() {
  const router = useRouter();
  return (
    <SettingsScreen
      role="b2b"
      onInvite={() => router.push("/(b2b)/add-colleague")}
      onManageColleague={(uid) => router.push(`/(b2b)/colleagues/${uid}`)}
    />
  );
}
