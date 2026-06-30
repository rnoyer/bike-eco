import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
                placeholderTextColor="#C1C1C6"
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
      </Modal>
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
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
  },
  triggerError: {
    borderColor: '#EF4444',
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  placeholderText: {
    color: '#C1C1C6',
  },
  chevron: {
    fontSize: 20,
    color: '#71727A',
    transform: [{ rotate: '90deg' }],
  },
  error: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  modal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  closeBtn: {
    fontSize: 16,
    color: '#71727A',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#FAFAFA',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  optionSelected: {
    backgroundColor: '#F9FAFB',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  optionTextSelected: {
    fontWeight: '600',
  },
  check: {
    fontSize: 16,
    color: '#111',
  },
});
