import { useRouter } from "expo-router";
import { Alert } from "react-native";
import DashboardScreen from "@/components/screens/DashboardScreen";

export default function B2bDashboard() {
  const router = useRouter();
  return (
    <DashboardScreen
      role="b2b"
      onOpenDossier={(id) => router.push(`/(b2b)/dossier/${id}`)}
      onSell={() =>
        Alert.alert("Bientôt disponible", "Le formulaire B2B arrive prochainement.")
      }
    />
  );
}
