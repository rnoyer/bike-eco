import Button from "@/components/ui/Button";
import { tokens } from "@/theme/tokens";
import { Modal, StyleSheet, Text, View } from "react-native";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  /** Label of the destructive action, e.g. "Tout supprimer". */
  confirmLabel: string;
  /** Locks both buttons while an action is already in flight. */
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Destructive-confirmation modal. An in-page `Modal`, not `confirmDialog`:
 *  these prompts spell out what is deleted, which a native alert cannot. */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  disabled = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{message}</Text>
          <Button label="Annuler" onPress={onCancel} disabled={disabled} />
          <Button
            variant="danger"
            label={confirmLabel}
            onPress={onConfirm}
            disabled={disabled}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "center",
    padding: tokens.space.lg,
  },
  modal: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    padding: tokens.space.lg,
    gap: tokens.space.md,
    // The backdrop covers the browser window — react-native-web portals a
    // `Modal` out of the root column — so the card caps itself at the app's
    // width instead of stretching across a desktop viewport. No effect on a
    // phone, which is narrower than the cap.
    width: "100%",
    maxWidth: tokens.layout.maxContentWidth,
    alignSelf: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: tokens.colors.primary },
  body: { fontSize: 14, color: tokens.colors.muted },
});
