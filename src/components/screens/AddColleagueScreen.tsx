import AddColleagueForm from "@/components/form/AddColleagueForm";
import { useInvite } from "@/lib/data/useInvite";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { alertDialog } from "@/lib/ui/dialog";
import { tokens } from "@/theme/tokens";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

interface Props {
  /** The invitation is on its way — go to the caller's confirmation screen. */
  onSent: () => void;
}

/** "Inviter un collègue", shared by both roles: `sendInvite` derives the
 *  invitation's role from the caller, so only the destination differs. */
export default function AddColleagueScreen({ onSent }: Props) {
  const { invite, pending } = useInvite({
    onError: (message) => alertDialog("Invitation impossible", message),
  });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={headerOptions({
          title: "Inviter un collègue",
        })}
      />
      <AddColleagueForm
        busy={pending}
        onSubmit={async (email) => {
          // `invite` resolves to undefined on failure, having already alerted.
          if (await invite(email)) onSent();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
