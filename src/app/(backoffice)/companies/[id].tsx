import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AccountInfoList from "@/components/native/AccountInfoList";
import CompanyInfoList from "@/components/native/CompanyInfoList";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import { callApproveCompany, callDeleteCompany } from "@/lib/data/registration";
import { useCompany, useCompanyUsers } from "@/lib/data/useCompanies";
import { tokens } from "@/theme/tokens";

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const company = useCompany(id);
  const users = useCompanyUsers(id);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (company.loading || users.loading) {
    return (
      <ActivityIndicator style={styles.center} color={tokens.colors.primary} />
    );
  }
  if (!company.data) {
    return <Text style={styles.center}>Entreprise introuvable.</Text>;
  }

  const owner =
    users.data.find((u) => u.id === company.data!.createdBy) ?? users.data[0];
  // "Autres utilisateurs" = everyone except the owner already shown above.
  const otherUsers = owner
    ? users.data.filter((u) => u.id !== owner.id)
    : users.data;
  const isPending = company.data.status === "pending";

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      router.back();
    } catch (err) {
      Alert.alert(
        "Action impossible",
        err instanceof Error ? err.message : "Veuillez réessayer.",
      );
    } finally {
      setBusy(false);
    }
  }

  function onDecline() {
    Alert.alert(
      "Décliner l'inscription",
      "Cette entreprise et son compte seront définitivement supprimés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Décliner",
          style: "destructive",
          onPress: () => run(() => callDeleteCompany(id)),
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {isPending ? (
        <Section title="Voulez-vous autoriser cette entreprise à vendre des véhicules">
          <View style={styles.row}>
            <Button
              label="Autoriser"
              onPress={() => run(() => callApproveCompany(id))}
              style={styles.flex}
              disabled={busy}
            />
            <Button
              variant="outlined"
              label="Décliner inscription"
              onPress={onDecline}
              style={styles.flex}
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
              variant="outlined"
              label="Supprimer cette entreprise"
              onPress={() => setConfirmDelete(true)}
              style={styles.danger}
              disabled={busy}
            />
          </Section>
        </>
      ) : null}

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
              variant="text"
              label="Supprimer tout"
              onPress={() => {
                setConfirmDelete(false);
                void run(() => callDeleteCompany(id));
              }}
              style={styles.danger}
              disabled={busy}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.xl },
  center: {
    flex: 1,
    textAlignVertical: "center",
    textAlign: "center",
    padding: tokens.space.xl,
  },
  row: { flexDirection: "row", gap: tokens.space.md },
  flex: { flex: 1 },
  userLine: { fontSize: 14, color: tokens.colors.primary },
  danger: { alignSelf: "flex-start" },
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
