import AccountInfoList from "@/components/native/AccountInfoList";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ScreenMessage from "@/components/ui/ScreenMessage";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { ScreenLoader } from "@/components/ui/Spinner";
import { roleLabel } from "@/lib/data/colleagues";
import { useUser } from "@/lib/data/useUser";
import { callDeleteColleague, callSetColleagueAdmin } from "@/lib/data/users";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { alertDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";

interface Props {
  uid: string;
  /** `false` renders the read-only back-office view: info only, no buttons. */
  canManage: boolean;
  /** Title of the information section. The back-office reads a *company's*
   *  user here, who is a vendeur to them, not a collaborateur. */
  infoTitle?: string;
  /** Called after a successful deletion — the route pops back to the list. */
  onDeleted?: () => void;
}

/** One colleague: their information, and (for an admin) the two actions on
 *  them. Owns its header title, because only this screen has read the name. */
export default function ColleagueScreen({
  uid,
  canManage,
  infoTitle = "Information collaborateur",
  onDeleted,
}: Props) {
  const { data, loading, error } = useUser(uid);
  const [confirming, setConfirming] = useState(false);

  // One action per button, so the button that is working is the one that spins;
  // `busy` then locks the other — same pattern as the company page.
  const onError = (message: string) => alertDialog("Action impossible", message);
  const toggling = useAsyncAction(async (next: boolean) => {
    await callSetColleagueAdmin(uid, next);
  }, { onError });
  const deleting = useAsyncAction(async () => {
    await callDeleteColleague(uid);
    onDeleted?.();
  }, { onError });
  const busy = toggling.pending || deleting.pending;

  // Rendered unconditionally, above the loading/error/not-found states: the
  // route isn't registered in its group `_layout.tsx`, so until this resolves
  // the native stack header would otherwise show the raw route name — and on
  // "Utilisateur introuvable." it would never recover at all. The name-bearing
  // title only exists once the read-only view's document has resolved; the
  // manage-mode title never depends on it.
  const fullName = data ? `${data.nom} ${data.prenom}` : null;
  const title = canManage ? "Collaborateur" : fullName ? `Détails ${fullName}` : "Détails";

  return (
    <ScrollView>
      <Stack.Screen options={headerOptions({ title })} />
      {loading ? (
        <ScreenLoader />
      ) : error ? (
        <ScreenMessage message={error} tone="danger" />
      ) : !data ? (
        <ScreenMessage message="Utilisateur introuvable." />
      ) : (
        <>
          <SectionWrapper>
            <Section title={infoTitle}>
              <AccountInfoList user={data} roleLabel={roleLabel(data)} />
            </Section>

            {canManage ? (
              <Section title="Gérer ce collaborateur">
                <Button
                  label={
                    data.isAdmin
                      ? "Retirer rôle Administrateur"
                      : "Ajouter rôle Administrateur"
                  }
                  onPress={() => void toggling.run(!data.isAdmin)}
                  loading={toggling.pending}
                  disabled={busy}
                />
                <Button
                  variant="danger"
                  label="Supprimer utilisateur"
                  onPress={() => setConfirming(true)}
                  loading={deleting.pending}
                  // An admin account cannot be deleted — remove the role first.
                  disabled={busy || data.isAdmin}
                />
              </Section>
            ) : null}
          </SectionWrapper>

          <ConfirmModal
            visible={confirming}
            title="Supprimer cet utilisateur ?"
            message={`Êtes-vous sûr de vouloir supprimer l'utilisateur ${fullName} ?`}
            confirmLabel="Supprimer utilisateur"
            disabled={busy}
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false);
              void deleting.run();
            }}
          />
        </>
      )}
    </ScrollView>
  );
}
