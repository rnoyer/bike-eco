import { Stack, useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import AddColleagueForm from "@/components/native/AddColleagueForm";
import { useDossierMutations } from "@/lib/data/useDossierMutations";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function B2bAddColleague() {
  const router = useRouter();
  const { invite } = useDossierMutations();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: "Inviter un collègue" })} />
      <AddColleagueForm
        onSubmit={async (email) => {
          await invite(email);
          router.replace("/(b2b)/confirmation");
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
