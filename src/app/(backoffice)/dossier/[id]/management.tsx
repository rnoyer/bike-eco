import { useGlobalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, StyleSheet } from "react-native";
import DossierManagementForm from "@/components/form/DossierManagementForm";
import { useDossier } from "@/lib/data/useDossier";
import { useDossierMutations } from "@/lib/data/useDossierMutations";
import { tokens } from "@/theme/tokens";

export default function BackofficeDossierManagement() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading } = useDossier(id);
  const { updateStatusAndPrice } = useDossierMutations();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {loading || !data ? (
        <ActivityIndicator style={styles.spinner} color={tokens.colors.primary} />
      ) : (
        <DossierManagementForm
          initialStatus={data.status}
          initialPrice={data.negotiatedPrice}
          onSubmit={async (status, price) => {
            try {
              await updateStatusAndPrice(id, status, price);
              router.replace("/(backoffice)/confirmation");
            } catch {
              Alert.alert(
                "Erreur",
                "La mise à jour n'a pas pu être enregistrée. Veuillez réessayer."
              );
            }
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
