import React from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';

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
          placeholderTextColor="#C1C1C6"
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
    fontWeight: '500',
    color: '#111',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
  },
  inputRowMultiline: {
    height: undefined,
    minHeight: 100,
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  inputRowError: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  inputMultiline: {
    minHeight: 72,
  },
  suffix: {
    fontSize: 14,
    color: '#71727A',
    marginLeft: 8,
  },
  error: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});
