import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import DossierManagementForm from "@/components/native/DossierManagementForm";
import { useDossier } from "@/lib/data/useDossier";
import { useDossierMutations } from "@/lib/data/useDossierMutations";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function BackofficeDossierManagement() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading } = useDossier(id);
  const { updateStatusAndPrice } = useDossierMutations();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: "Statut dossier" })} />
      {loading || !data ? (
        <ActivityIndicator style={styles.spinner} color={tokens.colors.primary} />
      ) : (
        <DossierManagementForm
          initialStatus={data.status}
          initialPrice={data.negotiatedPrice}
          onSubmit={async (status, price) => {
            await updateStatusAndPrice(id, status, price);
            router.replace("/(backoffice)/confirmation");
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg },
  spinner: { paddingVertical: 48 },
});
