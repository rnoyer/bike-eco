import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import InfoCard from "@/components/ui/InfoCard";
import InfoRows from "@/components/ui/InfoRows";
import ScreenMessage from "@/components/ui/ScreenMessage";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { ScreenLoader } from "@/components/ui/Spinner";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  frenchAuthMessage,
  mapPasswordResetError,
} from "@/lib/auth/authErrors";
import { hasPasswordProvider } from "@/lib/auth/passwordProvider";
import { useAccount } from "@/lib/data/useAccount";
import { useCompany } from "@/lib/data/useCompanies";
import { useSession } from "@/lib/data/useSession";
import { useUser } from "@/lib/data/useUser";
import { callDeleteMyAccount } from "@/lib/data/users";
import { alertDialog, confirmDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { tokens } from "@/theme/tokens";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { auth } from "../../../firebaseConfig";

export default function AccountScreen() {
  const { data, loading } = useAccount();
  const company = useCompany(data?.companyId ?? "");
  const { signOut } = useSession();
  const { firebaseUser } = useAuth();

  // Live rather than the AuthProvider snapshot taken at sign-in: a demoted
  // admin who already transferred the role must see the delete button enable
  // itself without restarting the app. Falls back to the session's value
  // while the live read is loading, so nothing flickers into a
  // more-permissive state.
  const { data: viewer, loading: viewerLoading } = useUser(data?.id ?? "");
  const isAdmin = viewerLoading
    ? data?.isAdmin === true
    : viewer?.isAdmin === true;

  const email = firebaseUser?.email ?? null;

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const sendingReset = useAsyncAction(
    async (address: string) => {
      await sendPasswordResetEmail(auth, address);
      alertDialog(
        "Email envoyé",
        `Un lien de réinitialisation vient d’être envoyé à ${address}. Vérifiez votre boîte de réception.`,
      );
    },
    {
      mapError: (e) =>
        mapPasswordResetError((e as { code?: string }).code ?? ""),
      onError: (message) => alertDialog("Changer mon mot de passe", message),
    },
  );

  const signingOut = useAsyncAction(signOut, {
    mapError: frenchAuthMessage,
    onError: (message) => alertDialog("Déconnexion impossible", message),
  });

  // The server deletes the Auth user, which invalidates this session; sign out
  // explicitly so the guard routes to sign-in instead of leaving a dead session.
  const deletingAccount = useAsyncAction(
    async () => {
      await callDeleteMyAccount();
      await signOut();
    },
    { onError: (message) => alertDialog("Suppression impossible", message) },
  );

  const handleChangePassword = () => {
    if (!email) return;
    confirmDialog({
      title: "Changer mon mot de passe",
      message: `Êtes-vous sur de vouloir changer votre mot de passe?`,
      confirmLabel: "Envoyer",
      onConfirm: () => void sendingReset.run(email),
    });
  };

  // Never `return null` here: a blank screen reads as a broken app, and this
  // is a tab the user can land on before the session resolves.
  if (loading) return <ScreenLoader />;
  if (!data) return <ScreenMessage message="Compte introuvable." />;
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionWrapper style={styles.fill}>
        <InfoCard title="Mes informations personnelles">
          {/* No action buttons on the contact rows here: it is the viewer's own
              number and address. */}
          <InfoRows
            rows={[
              ["Nom", data.nom],
              ["Prénom", data.prenom],
              ["Email", data.email],
              ["Téléphone", data.telephone],
            ]}
          />
        </InfoCard>
        {data.companyId ? (
          <InfoCard
            title={
              company.data
                ? `Informations ${company.data.name}`
                : "Informations entreprise"
            }
            loading={company.loading}
            error={company.error}
            emptyMessage="Entreprise introuvable."
          >
            {company.data ? (
              <InfoRows
                rows={[
                  ["SIRET", company.data.siret],
                  ["N° TVA", company.data.tva ?? ""],
                  ["Département", company.data.departement],
                  ["Ville", company.data.ville],
                ]}
              />
            ) : null}
          </InfoCard>
        ) : null}
        <Section title="Actions sur mon compte">
          <Button
            variant="primary"
            label="Se déconnecter"
            loading={signingOut.pending}
            onPress={() => void signingOut.run()}
          />
          {/* Hidden for Google-only accounts: they have no password to reset. */}
          {email && hasPasswordProvider(firebaseUser) ? (
            <Button
              variant="outlined"
              label="Changer mon mot de passe"
              onPress={handleChangePassword}
              loading={sendingReset.pending}
            />
          ) : null}
        </Section>
        {/* Outside <Section> on purpose: the auto margin needs a growing
            parent, and SectionWrapper is the one that fills the viewport. */}
        <View style={styles.toBottom}>
          <Button
            variant="danger"
            label="Supprimer mon compte"
            onPress={() => setConfirmingDelete(true)}
            loading={deletingAccount.pending}
            // An admin account cannot be deleted: the company would be left
            // with nobody able to manage its team.
            disabled={isAdmin || deletingAccount.pending}
          />
          {isAdmin ? (
            <Text style={styles.adminNote}>
              En tant qu&apos;administrateur, vous ne pouvez pas supprimer votre
              compte. Transférez d&apos;abord le rôle administrateur à un autre
              collaborateur.
            </Text>
          ) : null}
        </View>
      </SectionWrapper>
      <ConfirmModal
        visible={confirmingDelete}
        title="Supprimer mon compte ?"
        message="Cette action supprime définitivement votre compte. Vos dossiers et vos conversations sont conservés."
        confirmLabel="Supprimer mon compte"
        disabled={deletingAccount.pending}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          void deletingAccount.run();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // The three together pin the button to the bottom: the content container
  // stretches to at least the viewport, SectionWrapper takes that height, and
  // the auto margin eats the leftover space. Content taller than the viewport
  // simply scrolls, with the button last.
  scrollContent: { flexGrow: 1 },
  fill: { flexGrow: 1 },
  toBottom: { marginTop: "auto", gap: tokens.space.sm },
  adminNote: { fontSize: 13, color: tokens.colors.muted },
});
