import { useGlobalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import DossierManagementForm from "@/components/form/DossierManagementForm";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ScreenMessage from "@/components/ui/ScreenMessage";
import Section from "@/components/ui/Section";
import { ScreenLoader } from "@/components/ui/Spinner";
import { callDeleteDossier } from "@/lib/data/dossiers";
import { useAccount } from "@/lib/data/useAccount";
import { useDossier } from "@/lib/data/useDossier";
import { useDossierManagement } from "@/lib/data/useDossierManagement";
import { alertDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { tokens } from "@/theme/tokens";

export default function BackofficeDossierManagement() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useAccount();
  const { data, loading, error } = useDossier(id);
  const { updateManagement, pending } = useDossierManagement({
    onError: (message) => alertDialog("Mise à jour impossible", message),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  // `useDossier` is a live listener: the delete commits, the snapshot fires
  // empty, and the `!data` branch below would flash "Dossier introuvable." on a
  // successful delete. This holds the spinner until the redirect unmounts us.
  const [deleted, setDeleted] = useState(false);

  const deleting = useAsyncAction(
    async () => {
      await callDeleteDossier(id);
      setDeleted(true);
      router.replace({
        pathname: "/(backoffice)/confirmation",
        params: {
          title: "Dossier supprimé",
          message: "Le dossier a bien été supprimé.",
          redirectTo: "/(backoffice)/(tabs)/dashboard",
        },
      });
    },
    { onError: (message) => alertDialog("Suppression impossible", message) },
  );

  // One lock for both writes — they target the same dossier, so neither may
  // start while the other is in flight.
  const busy = pending || deleting.pending;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {loading || deleted ? (
        <ScreenLoader />
      ) : error ? (
        <ScreenMessage message={error} tone="danger" />
      ) : !data ? (
        <ScreenMessage message="Dossier introuvable." />
      ) : (
        <>
          <DossierManagementForm
            initialRegion={data.region}
            initialStatus={data.status}
            initialPrice={data.validatedPrice}
            busy={busy}
            onSubmit={async (region, status, price) => {
              if (!session) return;
              if (await updateManagement(id, region, status, price, session.id)) {
                router.replace("/(backoffice)/confirmation");
              }
            }}
          />

          <Section title="Gérer ce dossier">
            <Button
              variant="danger"
              label="Supprimer ce dossier"
              onPress={() => setConfirmDelete(true)}
              loading={deleting.pending}
              disabled={busy}
            />
          </Section>

          <ConfirmModal
            visible={confirmDelete}
            title="Supprimer ce dossier ?"
            message="Cette action supprime définitivement le dossier, ses conversations et ses documents associés."
            confirmLabel="Supprimer ce dossier"
            disabled={busy}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => {
              setConfirmDelete(false);
              void deleting.run();
            }}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.xl },
});
