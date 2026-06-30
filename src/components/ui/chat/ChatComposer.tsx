import { BottomSheet, Button, Host } from "@expo/ui";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/theme/tokens";

export default function ChatComposer({
  onSend,
}: {
  onSend: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      <TouchableOpacity
        style={styles.plus}
        onPress={() => setSheetOpen(true)}
        accessibilityLabel="Ajouter une pièce jointe"
      >
        <Text style={styles.plusText}>＋</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Votre message"
        placeholderTextColor={tokens.colors.muted}
        multiline
      />
      <TouchableOpacity style={styles.send} onPress={send}>
        <Text style={styles.sendText}>Envoyer</Text>
      </TouchableOpacity>

      <Host style={styles.sheetHost}>
        <BottomSheet isPresented={sheetOpen} onDismiss={() => setSheetOpen(false)}>
          <Button label="Photo" onPress={() => setSheetOpen(false)} />
          <Button label="PDF" onPress={() => setSheetOpen(false)} />
        </BottomSheet>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingTop: tokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.divider,
    backgroundColor: tokens.colors.surface,
  },
  plus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.divider,
  },
  plusText: { fontSize: 22, color: tokens.colors.primary, lineHeight: 24 },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    fontSize: 15,
  },
  send: { height: 40, paddingHorizontal: 12, justifyContent: "center" },
  sendText: { color: tokens.colors.primary, fontWeight: "700" },
  sheetHost: { position: "absolute", width: 0, height: 0 },
});
