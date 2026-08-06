import { useGroupHeaders } from "@/lib/navigation/groupHeaders";
import { Stack } from "expo-router";

export default function BackofficeLayout() {
  const { tabs, dossier } = useGroupHeaders("(backoffice)");
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="(tabs)" options={tabs} />
      <Stack.Screen name="dossier/[id]" options={dossier} />
      <Stack.Screen
        name="companies/index"
        options={{ title: "Gestion des entreprises vendeur" }}
      />
      <Stack.Screen name="companies/[id]" options={{ title: "Entreprise" }} />
      <Stack.Screen
        name="colleagues/index"
        options={{ title: "Mes collaborateurs" }}
      />
    </Stack>
  );
}
