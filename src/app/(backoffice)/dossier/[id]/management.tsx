import { useGlobalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, StyleSheet } from "react-native";
import DossierManagementForm from "@/components/form/DossierManagementForm";
import { useDossier } from "@/lib/data/useDossier";
import { useDossierManagement } from "@/lib/data/useDossierManagement";
import { tokens } from "@/theme/tokens";

export default function BackofficeDossierManagement() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading } = useDossier(id);
  const { updateManagement } = useDossierManagement();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {loading || !data ? (
        <ActivityIndicator style={styles.spinner} color={tokens.colors.primary} />
      ) : (
        <DossierManagementForm
          initialRegion={data.region}
          initialStatus={data.status}
          initialPrice={data.negotiatedPrice}
          onSubmit={async (region, status, price) => {
            try {
              await updateManagement(id, region, status, price);
              router.replace("/(backoffice)/confirmation");
            } catch (err) {
              Alert.alert(
                "Erreur",
                err instanceof Error
                  ? err.message
                  : "La mise à jour n'a pas pu être enregistrée. Veuillez réessayer."
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
