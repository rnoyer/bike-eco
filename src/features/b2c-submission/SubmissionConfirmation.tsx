import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/theme/tokens";

interface Props {
  onDone: () => void;
}

/** Terminal screen shown after the funnel is submitted (spec step 10). */
export default function SubmissionConfirmation({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.body}>
        <Text style={styles.title}>Demande envoyée !</Text>
        <Text style={styles.subtitle}>
          Un email récapitulatif va vous parvenir. Vous serez recontacté très
          prochainement par notre équipe.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.btn}
        onPress={onDone}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>Retour à l&apos;accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.lg,
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    ...tokens.text.title,
    marginBottom: tokens.space.md,
  },
  subtitle: {
    ...tokens.text.subtitle,
    lineHeight: 20,
  },
  btn: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.primary,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
    color: tokens.colors.primaryText,
  },
});
