import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { tokens } from "@/theme/tokens";

interface Props extends TextInputProps {
  label: string;
  error?: string;
  suffix?: string;
}

export default function FormField({ label, error, suffix, style, multiline, ...props }: Props) {
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
          {...props}
        />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: tokens.colors.primary,
    marginBottom: tokens.space.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: tokens.button.height,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 16,
  },
  inputRowMultiline: {
    height: undefined,
    minHeight: 100,
    alignItems: "flex-start",
    paddingVertical: 14,
  },
  inputRowError: {
    borderColor: tokens.colors.danger,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: tokens.colors.primary,
  },
  inputMultiline: {
    minHeight: 72,
  },
  suffix: {
    fontSize: 14,
    color: tokens.colors.muted,
    marginLeft: tokens.space.sm,
  },
  error: {
    fontSize: 12,
    color: tokens.colors.danger,
    marginTop: tokens.space.xs,
  },
});
