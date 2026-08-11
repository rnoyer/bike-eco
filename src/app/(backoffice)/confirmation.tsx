import { Stack, useLocalSearchParams, type Href } from "expo-router";
import ConfirmationView from "@/components/ui/ConfirmationView";

/**
 * The back office's one confirmation screen.
 *
 * Every field is an optional search param defaulting to the management flow's
 * copy, which is what lets a second flow (the dossier recap email) reuse the
 * route instead of adding a near-identical screen. `useLocalSearchParams`, not
 * the global one: this screen owns these params.
 */
export default function BackofficeConfirmation() {
  const { title, message, redirectTo } = useLocalSearchParams<{
    title?: string;
    message?: string;
    redirectTo?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConfirmationView
        title={title ?? "Mis à jour"}
        message={message ?? "Le dossier a bien été mis à jour."}
        delay={1500}
        // Typed routes cannot check a string built at runtime; the cast is the
        // boundary where a param becomes a route.
        redirectTo={(redirectTo ?? "/(backoffice)/(tabs)/dashboard") as Href}
      />
    </>
  );
}
