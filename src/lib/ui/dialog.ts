import { Alert } from "react-native";

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Label of the confirming action, e.g. "Envoyer". */
  confirmLabel: string;
  /** Renders the confirming action in the platform's destructive style. Web
   *  has no equivalent in `window.confirm`, so it is ignored there. */
  destructive?: boolean;
  onConfirm: () => void;
}

/** Yes/no dialog. Platform-split: `Alert.alert` is a **no-op** on
 *  react-native-web, so the `.web.ts` sibling uses `window.confirm`. Both files
 *  must keep the same signatures. */
export function confirmDialog({
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmOptions): void {
  Alert.alert(title, message, [
    { text: "Annuler", style: "cancel" },
    {
      text: confirmLabel,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}

/** Single-button informational dialog. */
export function alertDialog(title: string, message: string): void {
  Alert.alert(title, message);
}
