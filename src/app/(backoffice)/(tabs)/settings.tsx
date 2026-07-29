import SettingsScreen from "@/components/screens/SettingsScreen";
import { alertDialog } from "@/lib/ui/dialog";
import { useRouter } from "expo-router";

export default function BackofficeSettings() {
  const router = useRouter();
  return (
    <SettingsScreen
      role="backoffice"
      onManageCompanies={() => router.push("/(backoffice)/companies")}
      // Still a stub; it will need a pending state when it is wired.
      onInvite={() =>
        alertDialog("Inviter un collègue", "Action non disponible pour le moment.")
      }
    />
  );
}
