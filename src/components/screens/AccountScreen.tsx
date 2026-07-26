import AccountInfoList from "@/components/native/AccountInfoList";
import CompanyInfoList from "@/components/native/CompanyInfoList";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useAuth } from "@/lib/auth/AuthProvider";
import { mapPasswordResetError } from "@/lib/auth/authErrors";
import { hasPasswordProvider } from "@/lib/auth/passwordProvider";
import { useAccount } from "@/lib/data/useAccount";
import { useCompany } from "@/lib/data/useCompanies";
import { useSession } from "@/lib/data/useSession";
import { alertDialog, confirmDialog } from "@/lib/ui/dialog";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { auth } from "../../../firebaseConfig";

export default function AccountScreen() {
  const { data, loading } = useAccount();
  const company = useCompany(data?.companyId ?? "");
  const { signOut } = useSession();
  const { firebaseUser } = useAuth();
  const [resetBusy, setResetBusy] = useState(false);

  const email = firebaseUser?.email ?? null;

  const sendReset = async (address: string) => {
    setResetBusy(true);
    try {
      await sendPasswordResetEmail(auth, address);
      alertDialog(
        "Email envoyé",
        `Un lien de réinitialisation vient d’être envoyé à ${address}. Vérifiez votre boîte de réception.`,
      );
    } catch (e) {
      alertDialog(
        "Changer mon mot de passe",
        mapPasswordResetError((e as { code?: string }).code ?? ""),
      );
    } finally {
      setResetBusy(false);
    }
  };

  const handleChangePassword = () => {
    if (resetBusy || !email) return;
    confirmDialog({
      title: "Changer mon mot de passe",
      message: `Êtes-vous sur de vouloir changer votre mot de passe?`,
      confirmLabel: "Envoyer",
      onConfirm: () => void sendReset(email),
    });
  };

  if (loading || !data) return null; // guard shows briefly; layout splash covers first paint
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionWrapper style={styles.fill}>
        <Section title="Mes informations personnelles">
          <AccountInfoList user={data} />
        </Section>
        {data.companyId && company.data ? (
          <Section title={`Informations ${company.data.name}`}>
            <CompanyInfoList
              company={company.data}
              showName={false}
              showRegion={false}
            />
          </Section>
        ) : null}
        <Section title="Actions sur mon compte">
          <Button variant="primary" label="Se déconnecter" onPress={signOut} />
          {/* Hidden for Google-only accounts: they have no password to reset. */}
          {email && hasPasswordProvider(firebaseUser) ? (
            <Button
              variant="outlined"
              label="Changer mon mot de passe"
              onPress={handleChangePassword}
              disabled={resetBusy}
            />
          ) : null}
        </Section>
        {/* Outside <Section> on purpose: the auto margin needs a growing
            parent, and SectionWrapper is the one that fills the viewport. */}
        <Button
          style={styles.toBottom}
          variant="danger"
          label="Supprimer mon compte"
          onPress={() =>
            Alert.alert(
              "Supprimer mon compte",
              "Action non disponible pour le moment.",
            )
          }
        />
      </SectionWrapper>
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
  toBottom: { marginTop: "auto" },
});
