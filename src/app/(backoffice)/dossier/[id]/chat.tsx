import { useGlobalSearchParams } from "expo-router";
import DossierChatScreen from "@/components/screens/DossierChatScreen";

export default function BackofficeDossierChat() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  return <DossierChatScreen id={id} />;
}
