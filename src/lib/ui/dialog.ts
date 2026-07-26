import { Alert } from "react-native";

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Label of the confirming action, e.g. "Envoyer". */
  confirmLabel: string;
  onConfirm: () => void;
}

/** Yes/no dialog. Platform-split: `Alert.alert` is a **no-op** on
 *  react-native-web, so the `.web.ts` sibling uses `window.confirm`. Both files
 *  must keep the same signatures. */
export function confirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
}: ConfirmOptions): void {
  Alert.alert(title, message, [
    { text: "Annuler", style: "cancel" },
    { text: confirmLabel, onPress: onConfirm },
  ]);
}

/** Single-button informational dialog. */
export function alertDialog(title: string, message: string): void {
  Alert.alert(title, message);
}
