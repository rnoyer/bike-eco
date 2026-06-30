import { useLocalSearchParams } from "expo-router";
import DossierDetailScreen from "@/components/screens/DossierDetailScreen";

export default function B2bDossierDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DossierDetailScreen id={id} />;
}
