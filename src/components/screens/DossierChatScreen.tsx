import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import ChatComposer from "@/components/ui/chat/ChatComposer";
import ChatThread from "@/components/ui/chat/ChatThread";
import { formatSenderName } from "@/lib/chat/senderName";
import { useDossier } from "@/lib/data/useDossier";
import { useMessages } from "@/lib/data/useMessages";
import { useSendMessage } from "@/lib/data/useSendMessage";
import { useSession } from "@/lib/data/useSession";

export default function DossierChatScreen({ id }: { id: string }) {
  const { data: messages } = useMessages(id);
  // The dossier carries the company the thread belongs to: it keys the
  // attachment path, and its name labels a dealer's messages.
  const { data: dossier } = useDossier(id);
  const { user } = useSession();

  const { send } = useSendMessage(id, dossier?.companyId ?? "", {
    id: user?.id ?? "",
    name:
      user && dossier
        ? formatSenderName(user, dossier.submitter.companyName)
        : "",
    role: user?.role ?? "b2b",
  });

  if (!user || !dossier) return null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.flex}>
        <ChatThread messages={messages} currentUserId={user.id} />
        <ChatComposer
          onSend={(text) => {
            send(text).catch((err: Error) =>
              Alert.alert("Envoi impossible", err.message),
            );
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
