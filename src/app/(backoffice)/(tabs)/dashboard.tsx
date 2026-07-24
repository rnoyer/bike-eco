import { useRouter } from "expo-router";
import DashboardScreen from "@/components/screens/DashboardScreen";

export default function BackofficeDashboard() {
  const router = useRouter();
  return (
    <DashboardScreen
      role="backoffice"
      onOpenDossier={(id) => router.push(`/(backoffice)/dossier/${id}`)}
      onOpenCompanies={() => router.push("/(backoffice)/companies")}
    />
  );
}
