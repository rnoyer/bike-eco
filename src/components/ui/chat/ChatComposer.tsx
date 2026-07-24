import { BottomSheet, Button, Host } from "@expo/ui";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PickedFile } from "@/lib/data/useSendMessage";
import { tokens } from "@/theme/tokens";

export default function ChatComposer({
  onSend,
}: {
  onSend: (text: string, files: PickedFile[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const send = () => {
    const t = text.trim();
    if (!t && files.length === 0) return;
    onSend(t, files);
    setText("");
    setFiles([]);
  };

  async function pickPhoto() {
    setSheetOpen(false);
    if (files.length >= 5) {
      Alert.alert("Limite atteinte", "5 pièces jointes maximum par message.");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "L'accès à la galerie est nécessaire.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFiles((current) => [
      ...current,
      {
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        size: asset.fileSize ?? 0,
        mimeType: asset.mimeType ?? "image/jpeg",
        type: "image",
      },
    ]);
  }

  async function pickPdf() {
    setSheetOpen(false);
    if (files.length >= 5) {
      Alert.alert("Limite atteinte", "5 pièces jointes maximum par message.");
      return;
    }
    // `copyToCacheDirectory` so the file is readable straight away.
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFiles((current) => [
      ...current,
      {
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? 0,
        mimeType: asset.mimeType ?? "application/pdf",
        type: "pdf",
      },
    ]);
  }

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + tokens.space.sm }]}>
      {files.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pending}
        >
          {files.map((file, index) => (
            <TouchableOpacity
              key={`${file.uri}-${index}`}
              style={styles.chip}
              onPress={() =>
                setFiles((current) => current.filter((_, i) => i !== index))
              }
              accessibilityLabel={`Retirer ${file.name}`}
            >
              <Text style={styles.chipText} numberOfLines={1}>
                {file.type === "pdf" ? "📄" : "🖼️"} {file.name} ✕
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.row}>
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
          maxLength={4096}
          multiline
        />
        <TouchableOpacity style={styles.send} onPress={send}>
          <Text style={styles.sendText}>Envoyer</Text>
        </TouchableOpacity>
      </View>

      <Host style={styles.sheetHost}>
        <BottomSheet isPresented={sheetOpen} onDismiss={() => setSheetOpen(false)}>
          <Button label="Photo" onPress={pickPhoto} />
          <Button label="PDF" onPress={pickPdf} />
        </BottomSheet>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingTop: tokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.divider,
    backgroundColor: tokens.colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: tokens.space.sm,
  },
  pending: {
    gap: tokens.space.sm,
    paddingBottom: tokens.space.sm,
  },
  chip: {
    maxWidth: 200,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 6,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  chipText: { fontSize: 12, color: tokens.colors.primary },
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
    paddingVertical: tokens.space.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    fontSize: 15,
  },
  send: { height: 40, paddingHorizontal: tokens.space.md, justifyContent: "center" },
  sendText: { color: tokens.colors.primary, fontWeight: "700" },
  sheetHost: { position: "absolute", width: 0, height: 0 },
});
