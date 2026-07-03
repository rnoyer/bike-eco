import { useRouter } from "expo-router";
import DashboardScreen from "@/components/screens/DashboardScreen";

export default function B2bDashboard() {
  const router = useRouter();
  return (
    <DashboardScreen
      role="b2b"
      onOpenDossier={(id) => router.push(`/(b2b)/dossier/${id}`)}
      onSell={() => router.push("/(b2b)/vehicule-submission")}
    />
  );
}
