import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import Button from "@/components/ui/Button";
import ColleagueCard from "@/components/ui/ColleagueCard";
import ConfirmModal from "@/components/ui/ConfirmModal";
import InfoCard from "@/components/ui/InfoCard";
import InfoRows from "@/components/ui/InfoRows";
import ScreenMessage from "@/components/ui/ScreenMessage";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { ScreenLoader } from "@/components/ui/Spinner";
import { callApproveCompany, callDeleteCompany } from "@/lib/data/registration";
import { useCompany, useCompanyUsers } from "@/lib/data/useCompanies";
import { alertDialog, confirmDialog } from "@/lib/ui/dialog";
import { regionLabel } from "@/lib/ui/format";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { tokens } from "@/theme/tokens";

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const company = useCompany(id);
  const users = useCompanyUsers(id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // One action per button, so the button that is actually working is the one
  // that spins; `busy` then locks every other button on the screen, since
  // approve and decline are alternatives on the same decision.
  const onError = (message: string) =>
    alertDialog("Action impossible", message);
  const approving = useAsyncAction(
    async () => {
      await callApproveCompany(id);
      router.back();
    },
    { onError },
  );
  const deleting = useAsyncAction(
    async () => {
      await callDeleteCompany(id);
      router.back();
    },
    { onError },
  );
  const busy = approving.pending || deleting.pending;

  if (company.loading || users.loading) return <ScreenLoader />;
  const readError = company.error ?? users.error;
  if (readError) return <ScreenMessage message={readError} tone="danger" />;
  if (!company.data) {
    return <ScreenMessage message="Entreprise introuvable." />;
  }

  const isPending = company.data.status === "pending";

  function onDecline() {
    // `confirmDialog`, not `Alert.alert`: the latter is an empty function on
    // react-native-web, so this prompt never appeared in a browser.
    confirmDialog({
      title: "Décliner l'inscription",
      message:
        "Cette entreprise et son compte seront définitivement supprimés.",
      confirmLabel: "Décliner",
      destructive: true,
      onConfirm: () => void deleting.run(),
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionWrapper style={styles.content}>
        {isPending ? (
          <Section title="Voulez-vous autoriser cette entreprise à vendre des véhicules">
            <View style={styles.row}>
              <Button
                label="Autoriser"
                onPress={() => void approving.run()}
                style={styles.flex}
                loading={approving.pending}
                disabled={busy}
              />
              <Button
                variant="outlined"
                label="Décliner inscription"
                onPress={onDecline}
                style={styles.flex}
                loading={deleting.pending}
                disabled={busy}
              />
            </View>
          </Section>
        ) : null}

        <InfoCard title="Information Entreprise">
          <InfoRows
            rows={[
              ["Entreprise", company.data.name],
              ["SIRET", company.data.siret],
              ["N° TVA", company.data.tva ?? ""],
              ["Département", company.data.departement],
              ["Ville", company.data.ville],
              ["Région", regionLabel(company.data.region)],
            ]}
          />
        </InfoCard>

        <Section
          title="Vendeurs de cette entreprise"
          emptyMessage="Aucun utilisateur."
        >
          {users.data.map((u) => (
            <ColleagueCard
              key={u.id}
              user={u}
              actionLabel="Voir détails"
              onAction={() => router.push(`/(backoffice)/users/${u.id}`)}
            />
          ))}
        </Section>

        {!isPending ? (
          <View style={styles.toBottom}>
            <Section title="Supprimer cette entreprise">
              <Button
                variant="danger"
                label="Tout supprimer"
                onPress={() => setConfirmDelete(true)}
                loading={deleting.pending}
                disabled={busy}
              />
            </Section>
          </View>
        ) : null}
      </SectionWrapper>

      <ConfirmModal
        visible={confirmDelete}
        title="Supprimer cette entreprise ?"
        message="Cette action supprime définitivement l'entreprise, ses utilisateurs, tous ses dossiers, les conversations et les documents stockés."
        confirmLabel="Tout supprimer"
        disabled={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void deleting.run();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  toBottom: { marginTop: "auto", gap: tokens.space.sm },
  row: { flexDirection: "row", gap: tokens.space.md },
  flex: { flex: 1 },
});
