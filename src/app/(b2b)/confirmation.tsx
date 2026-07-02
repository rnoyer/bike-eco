import { Stack } from "expo-router";
import ConfirmationView from "@/components/ui/ConfirmationView";

export default function B2bConfirmation() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConfirmationView
        title="C'est envoyé !"
        message="L'invitation a bien été envoyée."
        delay={1500}
        redirectTo="/(b2b)/(tabs)/dashboard"
      />
    </>
  );
}
