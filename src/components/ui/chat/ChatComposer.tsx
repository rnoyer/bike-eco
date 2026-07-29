import { BottomSheet, Button, Host } from "@expo/ui";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Spinner from "@/components/ui/Spinner";
import type { PickedFile } from "@/lib/data/useSendMessage";
import { alertDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { tokens } from "@/theme/tokens";

/** Pure of component state so the picker flow stays readable: both return the
 *  files the user actually chose, capped at the room left in the message. */
async function pickPhotos(room: number): Promise<PickedFile[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    alertDialog("Permission refusée", "L'accès à la galerie est nécessaire.");
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: room,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, room).map((asset) => ({
    uri: asset.uri,
    name: asset.fileName ?? "photo.jpg",
    size: asset.fileSize ?? 0,
    mimeType: asset.mimeType ?? "image/jpeg",
    type: "image",
  }));
}

async function pickPdfs(room: number): Promise<PickedFile[]> {
  // `copyToCacheDirectory` so the file is readable straight away.
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, room).map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? 0,
    mimeType: asset.mimeType ?? "application/pdf",
    type: "pdf",
  }));
}

export default function ChatComposer({
  onSend,
}: {
  onSend: (text: string, files: PickedFile[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The keyboard covers the home indicator / navigation bar, so keeping the bottom
  // inset while it is open would leave a dead band between the bar and the keys.
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const canSend = text.trim().length > 0 || files.length > 0;

  // `canSend` is a render snapshot, so it cannot guard re-entry on its own: two
  // touch-ups delivered in the same JS batch both run before the clear commits,
  // both read the old text, and `useSendMessage.send` mints a fresh id per call
  // — so its own in-flight guard cannot dedupe them and the message is sent
  // twice. The latch is synchronous; the effect below releases it once the
  // clear has actually rendered.
  const justSent = useRef(false);
  useEffect(() => {
    justSent.current = false;
  }, [text, files]);

  // Clears immediately, as before — but the content is no longer thrown away:
  // it now lives in the thread's optimistic bubble until the send is confirmed,
  // and comes back with Réessayer / Supprimer if it fails.
  const send = () => {
    if (!canSend || justSent.current) return;
    justSent.current = true;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
  };

  // One action for both kinds — only one picker can be open at a time. It also
  // covers the waits nobody sees: the permission prompt, and `DocumentPicker`'s
  // `copyToCacheDirectory` pass, which is slow for a large PDF.
  const picking = useAsyncAction(
    async (kind: "photo" | "pdf") => {
      setSheetOpen(false);
      const room = 5 - files.length;
      if (room <= 0) {
        alertDialog("Limite atteinte", "5 pièces jointes maximum par message.");
        return;
      }
      const picked =
        kind === "photo" ? await pickPhotos(room) : await pickPdfs(room);
      if (picked.length > 0) setFiles((current) => [...current, ...picked]);
    },
    // Without this a picker that throws stops the spinner and does nothing
    // else — silently, which is the symptom this whole change exists to remove.
    { onError: (message) => alertDialog("Pièce jointe", message) },
  );

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom:
            (keyboardOpen ? 0 : insets.bottom) + tokens.space.sm,
        },
      ]}
    >
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
          disabled={picking.pending}
          accessibilityLabel="Ajouter une pièce jointe"
          accessibilityState={{ busy: picking.pending }}
        >
          {picking.pending ? (
            <Spinner />
          ) : (
            <Text style={styles.plusText}>＋</Text>
          )}
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
        <TouchableOpacity
          style={styles.send}
          onPress={send}
          disabled={!canSend}
          accessibilityState={{ disabled: !canSend }}
        >
          <Text style={[styles.sendText, !canSend && styles.sendTextDisabled]}>
            Envoyer
          </Text>
        </TouchableOpacity>
      </View>

      <Host style={styles.sheetHost}>
        <BottomSheet isPresented={sheetOpen} onDismiss={() => setSheetOpen(false)}>
          <Button label="Photo" onPress={() => void picking.run("photo")} />
          <Button label="PDF" onPress={() => void picking.run("pdf")} />
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
  sendTextDisabled: { color: tokens.colors.disabled },
  sheetHost: { position: "absolute", width: 0, height: 0 },
});
