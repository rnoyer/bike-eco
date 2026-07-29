import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";

import AccountInfoList from "@/components/native/AccountInfoList";
import CompanyInfoList from "@/components/native/CompanyInfoList";
import Button from "@/components/ui/Button";
import ScreenMessage from "@/components/ui/ScreenMessage";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { ScreenLoader } from "@/components/ui/Spinner";
import { callApproveCompany, callDeleteCompany } from "@/lib/data/registration";
import { useCompany, useCompanyUsers } from "@/lib/data/useCompanies";
import { alertDialog, confirmDialog } from "@/lib/ui/dialog";
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
  const onError = (message: string) => alertDialog("Action impossible", message);
  const approving = useAsyncAction(async () => {
    await callApproveCompany(id);
    router.back();
  }, { onError });
  const deleting = useAsyncAction(async () => {
    await callDeleteCompany(id);
    router.back();
  }, { onError });
  const busy = approving.pending || deleting.pending;

  if (company.loading || users.loading) return <ScreenLoader />;
  const readError = company.error ?? users.error;
  if (readError) return <ScreenMessage message={readError} tone="danger" />;
  if (!company.data) {
    return <ScreenMessage message="Entreprise introuvable." />;
  }

  const owner =
    users.data.find((u) => u.id === company.data!.createdBy) ?? users.data[0];
  // "Autres utilisateurs" = everyone except the owner already shown above.
  const otherUsers = owner
    ? users.data.filter((u) => u.id !== owner.id)
    : users.data;
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
    <ScrollView>
      <SectionWrapper>
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

        <Section title="Information vendeur">
          <CompanyInfoList company={company.data} />
        </Section>

        {owner ? (
          <Section title="Information vendeur admin">
            <AccountInfoList user={owner} />
          </Section>
        ) : null}

        {!isPending ? (
          <>
            <Section
              title="Autres utilisateurs de cette entreprise"
              emptyMessage="Aucun autre utilisateur."
            >
              {otherUsers.map((u) => (
                <Text
                  key={u.id}
                  style={styles.userLine}
                >{`${u.prenom} ${u.nom} — ${u.email}`}</Text>
              ))}
            </Section>
            <Section title="Gérer cette entreprise">
              <Button
                variant="danger"
                label="Supprimer cette entreprise"
                onPress={() => setConfirmDelete(true)}
                loading={deleting.pending}
                disabled={busy}
              />
            </Section>
          </>
        ) : null}
      </SectionWrapper>

      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Supprimer cette entreprise ?</Text>
            <Text style={styles.modalBody}>
              Cette action supprime définitivement l&apos;entreprise, ses
              utilisateurs, tous ses dossiers, les conversations et les
              documents stockés.
            </Text>
            <Button
              label="Annuler"
              onPress={() => setConfirmDelete(false)}
              disabled={busy}
            />
            <Button
              variant="danger"
              label="Supprimer tout"
              onPress={() => {
                setConfirmDelete(false);
                void deleting.run();
              }}
              disabled={busy}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: tokens.space.md },
  flex: { flex: 1 },
  userLine: { fontSize: 14, color: tokens.colors.primary },
  backdrop: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "center",
    padding: tokens.space.lg,
  },
  modal: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    padding: tokens.space.lg,
    gap: tokens.space.md,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: tokens.colors.primary },
  modalBody: { fontSize: 14, color: tokens.colors.muted },
});
