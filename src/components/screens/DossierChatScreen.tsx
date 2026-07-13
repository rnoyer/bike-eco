import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import ChatComposer from "@/components/ui/chat/ChatComposer";
import ChatThread from "@/components/ui/chat/ChatThread";
import { useDossierMutations } from "@/lib/data/useDossierMutations";
import { useMessages } from "@/lib/data/useMessages";
import { useSession } from "@/lib/data/useSession";

export default function DossierChatScreen({ id }: { id: string }) {
  const { data } = useMessages(id);
  const { user } = useSession();
  const { sendMessage } = useDossierMutations();
  if (!user) return null;
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.flex}>
        <ChatThread messages={data} currentUserId={user.id} />
        <ChatComposer onSend={(text) => sendMessage(id, text)} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
