import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatComposer from "@/components/ui/chat/ChatComposer";
import ChatThread from "@/components/ui/chat/ChatThread";
import ScreenMessage from "@/components/ui/ScreenMessage";
import { ScreenLoader } from "@/components/ui/Spinner";
import { useDossier } from "@/lib/data/useDossier";
import { useMessages } from "@/lib/data/useMessages";
import { useSendMessage } from "@/lib/data/useSendMessage";
import { useSession } from "@/lib/data/useSession";

export default function DossierChatScreen({ id }: { id: string }) {
  const messages = useMessages(id);
  // The dossier carries the company the thread belongs to: it keys the
  // attachment path for uploads.
  const dossier = useDossier(id);
  const { user, loading: sessionLoading } = useSession();

  // `messages.data` is passed in so the hook can drop an optimistic bubble the
  // moment its document lands — see `useSendMessage`.
  const { send, pending, retry, discard } = useSendMessage(
    id,
    dossier.data?.companyId ?? "",
    messages.data,
  );

  // `KeyboardAvoidingView` compares the keyboard's position — reported in screen
  // coordinates, measured from the very top of the display — against its own frame,
  // which is laid out inside this screen. Everything above the screen has to be handed
  // back as `keyboardVerticalOffset` or the composer stays under the keyboard:
  //
  //   - the group Stack header, measured because it is taller on notched devices;
  //   - on Android, the status bar on top of that: `measureInWindow` there reports `y`
  //     from below the status bar, so the two coordinate spaces differ by exactly
  //     `insets.top` (measured on a Pixel: header 56 + status bar 53.3 = 109.3).
  //     iOS measures from the top of the window, which already is the top of the
  //     screen, so it needs no correction.
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const keyboardOffset =
    headerHeight + (Platform.OS === "android" ? insets.top : 0);

  // Never `return null`: the thread rendered blank while it loaded, which is
  // indistinguishable from an empty conversation.
  if (sessionLoading || dossier.loading || messages.loading) {
    return <ScreenLoader />;
  }
  const readError = dossier.error ?? messages.error;
  if (readError) return <ScreenMessage message={readError} tone="danger" />;
  if (!user || !dossier.data) {
    return <ScreenMessage message="Conversation introuvable." />;
  }

  return (
    <View
      ref={rootRef}
      style={styles.flex}
      onLayout={() =>
        rootRef.current?.measureInWindow((_x, y) => setHeaderHeight(y))
      }
    >
      {/* `padding` on Android too: Expo enables edge-to-edge, so the manifest's
          `adjustResize` no longer shrinks the window and a behaviour-less
          `KeyboardAvoidingView` would do nothing at all. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={keyboardOffset}
      >
        <ChatThread
          messages={messages.data}
          pending={pending}
          currentUserId={user.id}
          onRetry={retry}
          onDiscard={discard}
        />
        {/* `send` no longer needs a `.catch` here: a failure surfaces on the
            bubble itself, with the user's text and attachments intact. */}
        <ChatComposer onSend={send} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
