import { useLocalSearchParams } from "expo-router";
import DossierChatScreen from "@/components/screens/DossierChatScreen";

export default function BackofficeDossierChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DossierChatScreen id={id} />;
}
