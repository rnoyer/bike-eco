import { isAppleSignInAvailable } from "@/lib/auth/appleSignIn";
import { tokens } from "@/theme/tokens";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

/**
 * Apple's own button, not a custom one.
 *
 * The Human Interface Guidelines allow a custom button only with the official
 * logo, an approved title, approved colours and proportions — and "Apple" alone,
 * which is what the rest of this row uses for its providers, is *not* an
 * approved title. The system button is Apple-approved by construction, and it
 * localises itself ("Se connecter avec Apple") and handles accessibility.
 *
 * WHITE_OUTLINE with the app's own corner radius and button height puts it
 * visually alongside the outlined buttons around it. `backgroundColor` and
 * `borderRadius` must not be set through `style` — that is both ineffective and
 * against the guidelines; `buttonStyle` and `cornerRadius` are the way.
 */
export default function AppleAuthButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    // Through the provider module rather than `expo-apple-authentication`
    // directly, so the native module has exactly one importer.
    void isAppleSignInAvailable().then((ok) => {
      if (active) setAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  // iOS 12 and below, or a device that cannot offer Apple sign-in at all: show
  // nothing rather than a button that can only fail.
  if (!available) return null;

  return (
    <View
      pointerEvents={disabled ? "none" : "auto"}
      style={disabled ? styles.disabled : undefined}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
        cornerRadius={tokens.radius.md}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The native button draws nothing without an explicit width and height.
  button: { width: "100%", height: tokens.button.height },
  disabled: { opacity: 0.5 },
});
