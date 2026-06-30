import { useLocalSearchParams } from "expo-router";
import DossierChatScreen from "@/components/screens/DossierChatScreen";

export default function B2bDossierChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DossierChatScreen id={id} />;
}
