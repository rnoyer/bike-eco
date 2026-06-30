import { Stack } from "expo-router";
import ConfirmationView from "@/components/ui/ConfirmationView";

export default function BackofficeConfirmation() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConfirmationView
        title="Mis à jour"
        message="Le dossier a bien été mis à jour."
        delay={1500}
        redirectTo="/(backoffice)/(tabs)/dashboard"
      />
    </>
  );
}
