import { useGlobalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import DossierManagementForm from "@/components/form/DossierManagementForm";
import ScreenMessage from "@/components/ui/ScreenMessage";
import { ScreenLoader } from "@/components/ui/Spinner";
import { useDossier } from "@/lib/data/useDossier";
import { useDossierManagement } from "@/lib/data/useDossierManagement";
import { alertDialog } from "@/lib/ui/dialog";
import { tokens } from "@/theme/tokens";

export default function BackofficeDossierManagement() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error } = useDossier(id);
  const { updateManagement, pending } = useDossierManagement({
    onError: (message) => alertDialog("Mise à jour impossible", message),
  });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? (
        <ScreenLoader />
      ) : error ? (
        <ScreenMessage message={error} tone="danger" />
      ) : !data ? (
        <ScreenMessage message="Dossier introuvable." />
      ) : (
        <DossierManagementForm
          initialRegion={data.region}
          initialStatus={data.status}
          initialPrice={data.negotiatedPrice}
          busy={pending}
          onSubmit={async (region, status, price) => {
            if (await updateManagement(id, region, status, price)) {
              router.replace("/(backoffice)/confirmation");
            }
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg },
});
