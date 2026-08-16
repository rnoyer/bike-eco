import { useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebColumn from "@/components/ui/WebColumn";
import { tokens } from "@/theme/tokens";

interface Props {
  label: string;
  placeholder?: string;
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
  searchable?: boolean;
}

export default function Dropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
  error,
  searchable,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered =
    searchable && search.length > 0
      ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
      : options;

  function handleSelect(item: string) {
    onChange(item);
    setOpen(false);
    setSearch('');
  }

  function handleClose() {
    setOpen(false);
    setSearch('');
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.trigger, error ? styles.triggerError : undefined]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, !value && styles.placeholderText]}>
          {value ?? placeholder ?? 'Sélectionner'}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        {/* The sheet is full-screen, and on web it portals out of the root
            column — so it declares its own or it spans the whole browser. */}
        <WebColumn>
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={12}>
                <Text style={styles.closeBtn}>Fermer</Text>
              </TouchableOpacity>
            </View>

            {searchable && (
              <View style={styles.searchWrap}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher..."
                  placeholderTextColor={tokens.colors.disabled}
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                  clearButtonMode="while-editing"
                />
              </View>
            )}

            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, value === item && styles.optionSelected]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={[styles.optionText, value === item && styles.optionTextSelected]}>
                    {item}
                  </Text>
                  {value === item && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </WebColumn>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: tokens.text.fieldLabel,
  trigger: tokens.control.base,
  triggerError: tokens.control.error,
  triggerText: tokens.control.text,
  placeholderText: {
    color: tokens.colors.disabled,
  },
  chevron: {
    fontSize: 20,
    color: tokens.colors.muted,
    transform: [{ rotate: "90deg" }],
  },
  error: tokens.text.fieldError,
  modal: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.space.lg,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: tokens.colors.primary,
  },
  closeBtn: {
    fontSize: 16,
    color: tokens.colors.muted,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: tokens.space.md,
  },
  searchInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: tokens.colors.primary,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.space.lg,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.divider,
  },
  // Tinted, not grey: the previous #F9FAFB fill was ~1.02:1 on white, so the
  // current choice was invisible in a long list.
  optionSelected: {
    backgroundColor: tokens.colors.brandTint,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: tokens.colors.primary,
  },
  optionTextSelected: {
    fontWeight: "600",
  },
  check: {
    fontSize: 16,
    color: tokens.colors.primary,
  },
});
