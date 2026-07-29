import { Stack, useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import AddColleagueForm from "@/components/form/AddColleagueForm";
import { useInvite } from "@/lib/data/useInvite";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { alertDialog } from "@/lib/ui/dialog";
import { tokens } from "@/theme/tokens";

export default function B2bAddColleague() {
  const router = useRouter();
  const { invite, pending } = useInvite({
    onError: (message) => alertDialog("Invitation impossible", message),
  });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: "Inviter un collègue" })} />
      <AddColleagueForm
        busy={pending}
        onSubmit={async (email) => {
          // `invite` resolves to undefined on failure, having already alerted.
          if (await invite(email)) router.replace("/(b2b)/confirmation");
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
