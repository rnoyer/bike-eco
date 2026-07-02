import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { tokens } from "@/theme/tokens";

interface Props {
  label?: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}

/** A multi-select list of checkboxes backed by an array of selected labels. */
export default function CheckboxGroup({
  label,
  options,
  value,
  onChange,
  error,
}: Props) {
  function toggle(option: string) {
    onChange(
      value.includes(option)
        ? value.filter((v) => v !== option)
        : [...value, option],
    );
  }

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.options}>
        {options.map((option) => {
          const checked = value.includes(option);
          return (
            <TouchableOpacity
              key={option}
              style={styles.row}
              onPress={() => toggle(option)}
              activeOpacity={0.7}
            >
              <View style={[styles.box, checked && styles.boxChecked]}>
                {checked && <Text style={styles.check}>✓</Text>}
              </View>
              <Text style={styles.optionText}>{option}</Text>
            </TouchableOpacity>
          );
        })}
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
  options: {
    gap: tokens.space.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.md,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  check: {
    color: tokens.colors.primaryText,
    fontSize: 14,
    fontWeight: "700",
  },
  optionText: {
    fontSize: 16,
    color: tokens.colors.primary,
  },
  error: {
    fontSize: 12,
    color: tokens.colors.danger,
    marginTop: tokens.space.xs,
  },
});
