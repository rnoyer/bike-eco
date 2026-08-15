import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * Whether the software keyboard is currently up.
 *
 * The one thing this is for: a bottom bar that pads itself with `insets.bottom`
 * has to drop that inset while the keyboard is open. The keyboard already covers
 * the home indicator / navigation bar, so keeping the inset leaves a dead band
 * between the bar and the keys — ~34pt of it on a notched iPhone.
 *
 * `keyboardDidShow` / `keyboardDidHide` rather than the `Will` pair: they fire on
 * both platforms (`keyboardWillShow` is iOS-only), so one listener pair covers the
 * app. The trade is that the inset drops a frame after the lift animation settles.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setOpen(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return open;
}
