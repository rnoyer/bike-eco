import { Image } from "expo-image";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { tokens } from "@/theme/tokens";

import eyeIcon from "@/assets/images/icons/eye.svg";
import eyeOffIcon from "@/assets/images/icons/eye-off.svg";

interface Props extends TextInputProps {
  label: string;
  error?: string;
  suffix?: string;
}

export default function FormField({
  label,
  error,
  suffix,
  style,
  multiline,
  secureTextEntry,
  ...props
}: Props) {
  // Any masked field gets a reveal toggle. The `TextInput` below stays mounted
  // across the flip (no `key`, no remount) — remounting it lets iOS autofill
  // wipe the value.
  const [hidden, setHidden] = useState(true);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          multiline && styles.inputRowMultiline,
          error ? styles.inputRowError : undefined,
        ]}
      >
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline, style]}
          placeholderTextColor={tokens.colors.disabled}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'auto'}
          secureTextEntry={secureTextEntry && hidden}
          {...props}
        />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
        {secureTextEntry && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            // Android makes a pressable view focusable as soon as it has an
            // `onPress`; without this the tap pulls focus off the input and the
            // `onBlur` validation fires on a half-typed password.
            focusable={false}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              hidden ? "Afficher le mot de passe" : "Masquer le mot de passe"
            }
            style={styles.toggle}
          >
            <Image
              source={hidden ? eyeOffIcon : eyeIcon}
              style={styles.toggleIcon}
              tintColor={tokens.colors.muted}
              contentFit="contain"
            />
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: tokens.text.fieldLabel,
  inputRow: tokens.control.base,
  inputRowMultiline: {
    height: undefined,
    minHeight: 100,
    alignItems: "flex-start",
    paddingVertical: 14,
  },
  inputRowError: tokens.control.error,
  input: tokens.control.text,
  inputMultiline: {
    minHeight: 72,
  },
  suffix: {
    fontSize: 14,
    color: tokens.colors.muted,
    marginLeft: tokens.space.sm,
  },
  toggle: {
    marginLeft: tokens.space.sm,
  },
  toggleIcon: {
    width: 22,
    height: 22,
  },
  error: tokens.text.fieldError,
});
