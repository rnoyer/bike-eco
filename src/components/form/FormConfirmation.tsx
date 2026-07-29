import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  message?: string;
  buttonLabel: string;
  onDone: () => void;
  /** Set while `onDone` does async work. "Aller à l'accueil" signs the user in
   *  and refreshes the session before it navigates — several seconds during
   *  which the button must not look idle or accept a second tap. */
  busy?: boolean;
}

/** Button-driven terminal screen shown at the end of a form funnel. */
export default function FormConfirmation({
  title,
  message,
  buttonLabel,
  onDone,
  busy = false,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.subtitle}>{message}</Text> : null}
      </View>
      <Button label={buttonLabel} onPress={onDone} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.lg,
  },
  body: { flex: 1, justifyContent: "center" },
  title: { ...tokens.text.title, marginBottom: tokens.space.md },
  subtitle: { ...tokens.text.subtitle, lineHeight: 20 },
});
