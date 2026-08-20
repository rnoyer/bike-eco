import { Stack, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import EditProfileFieldForm from "@/components/form/EditProfileFieldForm";
import ConfirmationView from "@/components/ui/ConfirmationView";
import ScreenMessage from "@/components/ui/ScreenMessage";
import { ScreenLoader } from "@/components/ui/Spinner";
import {
  isEditableProfileField,
  PROFILE_FIELDS,
} from "@/features/profile/fields";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAccount } from "@/lib/data/useAccount";
import { callUpdateMyProfile } from "@/lib/data/users";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { alertDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { tokens } from "@/theme/tokens";

interface Props {
  /** Where "Annuler" and the confirmation both go back to — the caller's
   *  "Mon compte" tab. */
  accountHref: Href;
  onCancel: () => void;
}

/**
 * "Modifier mon nom / prénom / téléphone", shared by both roles: the callable
 * derives the account from the caller, so only the destination differs.
 *
 * Which field is edited comes from the `?field=` search param — `useLocalSearchParams`,
 * not the global one: this screen owns that param.
 */
export default function EditProfileFieldScreen({ accountHref, onCancel }: Props) {
  const { field } = useLocalSearchParams<{ field?: string }>();
  const { data, loading } = useAccount();
  const { refreshSession } = useAuth();
  const [done, setDone] = useState(false);

  const updating = useAsyncAction(
    async (value: string) => {
      if (!isEditableProfileField(field)) return;
      await callUpdateMyProfile({ [field]: value });
      // `AuthProvider` reads the profile with `getDoc`, not a live listener, so
      // without this "Mon compte" comes back showing the value we just replaced.
      await refreshSession();
      setDone(true);
    },
    { onError: (message) => alertDialog("Modification impossible", message) },
  );

  // Never `return null` while the session resolves: a blank screen reads as a
  // broken app.
  if (loading) return <ScreenLoader />;
  // `email` lands here too, along with a hand-typed param: a field that has no
  // edit form must say so, not render an untitled one.
  if (!isEditableProfileField(field)) {
    return (
      <>
        <Stack.Screen options={headerOptions({ title: "Modifier" })} />
        <ScreenMessage message="Information non modifiable." tone="danger" />
      </>
    );
  }
  if (!data) return <ScreenMessage message="Compte introuvable." />;

  if (done) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ConfirmationView
          title="Mis à jour"
          message="Vos informations ont bien été mises à jour."
          delay={1500}
          redirectTo={accountHref}
        />
      </>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: PROFILE_FIELDS[field].title })} />
      <EditProfileFieldForm
        field={field}
        initialValue={data[field]}
        busy={updating.pending}
        onCancel={onCancel}
        onSubmit={(value) => void updating.run(value)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
