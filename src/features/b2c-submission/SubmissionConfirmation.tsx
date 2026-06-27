import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
        <Text style={styles.btnText}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: "#71727A",
    lineHeight: 20,
  },
  btn: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
