import { useGlobalSearchParams } from "expo-router";
import DossierDetailScreen from "@/components/screens/DossierDetailScreen";

export default function BackofficeDossierDetail() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  return <DossierDetailScreen id={id} />;
}
