import { Stack } from "expo-router";
import { useGroupHeaders } from "@/lib/navigation/groupHeaders";

export default function BackofficeLayout() {
  const { tabs, dossier } = useGroupHeaders("(backoffice)");
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="(tabs)" options={tabs} />
      <Stack.Screen name="dossier/[id]" options={dossier} />
      <Stack.Screen name="companies/index" options={{ title: "Vendeurs enregistrées" }} />
      <Stack.Screen name="companies/[id]" options={{ title: "Vendeur" }} />
    </Stack>
  );
}
