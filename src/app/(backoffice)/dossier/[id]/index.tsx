import { useLocalSearchParams } from "expo-router";
import DossierDetailScreen from "@/components/screens/DossierDetailScreen";

export default function BackofficeDossierDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DossierDetailScreen id={id} />;
}
