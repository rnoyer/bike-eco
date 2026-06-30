import { Stack } from "expo-router";
import { useGroupHeaders } from "@/lib/navigation/groupHeaders";

export default function BackofficeLayout() {
  const { tabs, dossier } = useGroupHeaders("(backoffice)");
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="(tabs)" options={tabs} />
      <Stack.Screen name="dossier/[id]" options={dossier} />
    </Stack>
  );
}
