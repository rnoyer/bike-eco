import type { ConfirmOptions } from "./dialog";

/** Web sibling of `dialog.ts`: react-native-web ships `Alert.alert` as an empty
 *  function, so a native-only implementation would silently do nothing here. */
export function confirmDialog({
  title,
  message,
  onConfirm,
}: ConfirmOptions): void {
  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}

export function alertDialog(title: string, message: string): void {
  window.alert(`${title}\n\n${message}`);
}
