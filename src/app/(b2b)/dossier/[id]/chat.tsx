import { useGlobalSearchParams } from "expo-router";
import DossierChatScreen from "@/components/screens/DossierChatScreen";

export default function B2bDossierChat() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  return <DossierChatScreen id={id} />;
}
