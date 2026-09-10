import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import InfoCard from "@/components/ui/InfoCard";
import InfoEditableRow from "@/components/ui/InfoEditableRow";
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
import { useColleagues } from "@/lib/data/useColleagues";
import { useCompany } from "@/lib/data/useCompanies";
import { useSession } from "@/lib/data/useSession";
import { useIsAdmin } from "@/lib/data/useIsAdmin";
import { callDeleteMyAccount } from "@/lib/data/users";
import { alertDialog, confirmDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { useTabBarInset } from "@/lib/ui/useTabBarInset";
import { tokens } from "@/theme/tokens";
import { deleteAccountPrompt } from "@/features/profile/deleteAccountPrompt";
import {
  PROFILE_FIELDS,
  type EditableProfileField,
} from "@/features/profile/fields";
import { sendPasswordResetEmail } from "firebase/auth";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { auth } from "../../../firebaseConfig";

/** Which group's edit route this screen sends the pencil buttons to — the two
 *  differ only in their prefix, and each stays inside its own stack. */
type EditProfileHref =
  | "/(b2b)/edit-profile"
  | "/(backoffice)/edit-profile";

/** Where "Gérer mes collaborateurs" sends an admin who cannot leave yet. */
type SettingsHref =
  | "/(b2b)/(tabs)/settings"
  | "/(backoffice)/(tabs)/settings";

export default function AccountScreen() {
  const { data, loading } = useAccount();
  const router = useRouter();
  const company = useCompany(data?.companyId ?? "");
  const { signOut } = useSession();
  const { firebaseUser } = useAuth();

  const isAdmin = useIsAdmin();
  // Live, so a colleague promoted on another device changes which modal this
  // button opens without a restart. The list already excludes the viewer.
  const colleagues = useColleagues();

  // "Supprimer mon compte" is pinned to the bottom of the viewport, which on
  // iOS is behind the translucent tab bar unless the space is reserved here.
  const tabBarInset = useTabBarInset();

  const email = firebaseUser?.email ?? null;

  // The account tab is mounted in both groups, and each must push its own edit
  // route — a b2b user pushed onto `(backoffice)` would hit that group's guard.
  const isBackoffice = data?.role === "backoffice";
  const editProfileHref: EditProfileHref = isBackoffice
    ? "/(backoffice)/edit-profile"
    : "/(b2b)/edit-profile";
  const settingsHref: SettingsHref = isBackoffice
    ? "/(backoffice)/(tabs)/settings"
    : "/(b2b)/(tabs)/settings";
  const editProfile = (field: EditableProfileField) =>
    router.push({ pathname: editProfileHref, params: { field } });

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const prompt = deleteAccountPrompt({
    role: data?.role ?? "b2b",
    isAdmin,
    others: colleagues.data ?? [],
    companyId: data?.companyId ?? null,
    companyName: company.data?.name ?? null,
  });

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
  //
  // The last member of a company takes the company with them, and that is a
  // bigger exit than "you are signed out" — so it lands on the app's front
  // screen instead. The `replace` happens *before* the sign-out on purpose:
  // afterwards it would race the auth guard, which sees a session-less viewer
  // still on `(b2b)` and replaces to `/(auth)/signin`. From `index`, a public
  // segment, the guard leaves them alone.
  const deletingAccount = useAsyncAction(
    async (withCompany: boolean) => {
      await callDeleteMyAccount();
      if (withCompany) router.replace("/");
      await signOut();
    },
    { onError: (message) => alertDialog("Suppression impossible", message) },
  );

  const confirmDelete = () => {
    setConfirmingDelete(false);
    if (prompt.action === "manage") {
      router.push(settingsHref);
      return;
    }
    void deletingAccount.run(prompt.action === "deleteWithCompany");
  };

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
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: tabBarInset },
      ]}
    >
      <SectionWrapper style={styles.fill}>
        <InfoCard title="Mes informations personnelles">
          {/* One part per row, not one `InfoRows` of four: the card draws the
              hairline between consecutive parts, and that line above and below
              is what makes an editable row read as its own thing.

              No phone / mail action buttons here: it is the viewer's own number
              and address, so the one action a row carries is "modifier". */}
          <InfoEditableRow
            label={PROFILE_FIELDS.nom.rowLabel}
            value={data.nom}
            onPress={() => editProfile("nom")}
          />
          <InfoEditableRow
            label={PROFILE_FIELDS.prenom.rowLabel}
            value={data.prenom}
            onPress={() => editProfile("prenom")}
          />
          {/* Not editable: the email *is* the sign-in credential, and changing
              it is an auth flow, not a profile write. */}
          <InfoRows rows={[["Email", data.email]]} />
          <InfoEditableRow
            label={PROFILE_FIELDS.telephone.rowLabel}
            value={data.telephone}
            onPress={() => editProfile("telephone")}
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
            // Never disabled for an admin any more: which of the modals opens
            // is decided in `deleteAccountPrompt`, and an admin the
            // organisation still needs is told why and where to go — rather
            // than left tapping a dead button with an explanation under it.
            // Only the colleague read gates it, because that decision needs it.
            disabled={colleagues.loading || deletingAccount.pending}
          />
        </View>
      </SectionWrapper>
      <ConfirmModal
        visible={confirmingDelete}
        title="Supprimer mon compte ?"
        message={prompt.message}
        confirmLabel={prompt.actionLabel}
        // "Gérer mes collaborateurs" deletes nothing — it must not be red.
        confirmVariant={prompt.action === "manage" ? "outlined" : "danger"}
        disabled={deletingAccount.pending}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={confirmDelete}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // The three together pin the button to the bottom: the content container
  // stretches to at least the viewport, SectionWrapper takes that height, and
  // the auto margin eats the leftover space. Content taller than the viewport
  // simply scrolls, with the button last. The viewport here is the whole
  // screen, tab bar included, so the container also pads itself by
  // `useTabBarInset()` — otherwise the delete button lands under it.
  scrollContent: { flexGrow: 1 },
  fill: { flexGrow: 1 },
  toBottom: { marginTop: "auto", gap: tokens.space.sm },
});
