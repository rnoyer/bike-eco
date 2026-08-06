import { Stack } from "expo-router";
import ConfirmationView from "@/components/ui/ConfirmationView";

export default function BackofficeInviteSent() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConfirmationView
        title="C'est envoyé !"
        message="L'invitation a bien été envoyée."
        delay={1500}
        redirectTo="/(backoffice)/(tabs)/dashboard"
      />
    </>
  );
}
