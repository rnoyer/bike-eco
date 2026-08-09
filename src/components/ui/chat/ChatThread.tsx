import pdfIcon from "@/assets/images/icons/pdfIcon.svg";
import ImageViewerModal from "@/components/ui/ImageViewerModal";
import Spinner from "@/components/ui/Spinner";
import type { PendingMessage } from "@/lib/data/useSendMessage";
import type { WithId } from "@/lib/firestore/collections";
import type { Message, MessageAttachment } from "@/lib/firestore/schema";
import { storageUrl } from "@/lib/storage/displayUrl";
import { isNearBottom } from "@/lib/ui/chatScroll";
import { alertDialog } from "@/lib/ui/dialog";
import { tokens } from "@/theme/tokens";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

function timeLabel(m: Message): string {
  return m.createdAt.toDate().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function openPdf(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    alertDialog("Pièce jointe", "Impossible d'ouvrir le PDF.");
  }
}

/** `mine` bubbles are near-black (`tokens.colors.primary`), so the PDF row has to
 *  flip to light-on-dark or it renders invisible against its own bubble.
 *
 *  `interactive` is false for a not-yet-sent attachment: its `url` is a local
 *  `file://` uri, which previews fine but has nothing meaningful to open. */
function Attachment({
  a,
  mine,
  interactive = true,
  onOpenImage,
}: {
  a: MessageAttachment;
  mine: boolean;
  interactive?: boolean;
  onOpenImage?: (url: string) => void;
}) {
  // A pending attachment's `file://` uri passes through untouched.
  const url = storageUrl(a.url);

  if (a.type === "image") {
    const thumb = (
      <Image
        source={{ uri: url }}
        style={styles.thumb}
        contentFit="cover"
        transition={100}
      />
    );
    if (!interactive) return thumb;
    return <Pressable onPress={() => onOpenImage?.(url)}>{thumb}</Pressable>;
  }
  const row = (
    <>
      <Image source={pdfIcon} style={styles.pdfIcon} contentFit="contain" />
      <Text
        style={[styles.pdfName, mine && styles.pdfNameMine]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {a.name}
      </Text>
    </>
  );
  if (!interactive) {
    return <View style={[styles.pdf, mine && styles.pdfMine]}>{row}</View>;
  }
  return (
    <Pressable
      style={[styles.pdf, mine && styles.pdfMine]}
      onPress={() => openPdf(url)}
    >
      {row}
    </Pressable>
  );
}

/** An optimistic bubble: the user's message, still on its way. It holds the
 *  text and the attachments so a failure loses neither — the composer clears
 *  immediately, and this is where the content lives until it is confirmed. */
function PendingBubble({
  message,
  onRetry,
  onDiscard,
}: {
  message: PendingMessage;
  onRetry: (message: PendingMessage) => void;
  onDiscard: (id: string) => void;
}) {
  const sending = message.status === "sending";
  return (
    <View style={[styles.row, styles.rowMine]}>
      <View style={[styles.bubble, styles.mine, sending && styles.sending]}>
        {message.text ? (
          <Text style={[styles.text, styles.textMine]}>{message.text}</Text>
        ) : null}
        {message.files.map((f, i) => (
          <Attachment
            key={`${f.uri}-${i}`}
            a={{ type: f.type, url: f.uri, name: f.name, size: f.size }}
            mine
            interactive={false}
          />
        ))}
        {sending ? (
          <View style={styles.statusRow}>
            <Spinner color="rgba(255,255,255,0.7)" />
            <Text style={[styles.time, styles.timeMine]}>Envoi…</Text>
          </View>
        ) : (
          <>
            <Text style={styles.failed}>
              {message.error ?? "L'envoi a échoué."}
            </Text>
            <View style={styles.actions}>
              <Pressable onPress={() => onRetry(message)} hitSlop={6}>
                <Text style={styles.action}>Réessayer</Text>
              </Pressable>
              <Pressable onPress={() => onDiscard(message.id)} hitSlop={6}>
                <Text style={styles.action}>Supprimer</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export default function ChatThread({
  messages,
  pending,
  currentUserId,
  onRetry,
  onDiscard,
}: {
  messages: WithId<Message>[];
  pending: PendingMessage[];
  currentUserId: string;
  onRetry: (message: PendingMessage) => void;
  onDiscard: (id: string) => void;
}) {
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // A `ScrollView` opens at offset 0 and stays there. The thread is oldest-first
  // (`useMessages` orders by `createdAt`), so without this the screen opens on
  // the *oldest* messages and every new bubble lands below the fold — which is
  // what made a notification tap look like it had dropped the user above the
  // composer.
  const scrollRef = useRef<ScrollView>(null);
  // Whether a new bubble is allowed to move the view. Starts true so the first
  // layout pins to the bottom; goes false as soon as the user scrolls up to read
  // history, so an arriving message never yanks them away from what they read.
  const followingRef = useRef(true);
  // The first scroll must not animate: the user asked for this thread, and
  // watching it fly past its history is not an arrival, it is a glitch.
  const arrivedRef = useRef(false);

  function stickToBottom() {
    if (!followingRef.current) return;
    scrollRef.current?.scrollToEnd({ animated: arrivedRef.current });
    arrivedRef.current = true;
  }

  // Sending is the one case that overrides the user's scroll position: the
  // bubble is theirs and they just created it, so it always pulls the view down.
  const pendingCount = pending.length;
  useEffect(() => {
    if (pendingCount === 0) return;
    followingRef.current = true;
    scrollRef.current?.scrollToEnd({ animated: arrivedRef.current });
    arrivedRef.current = true;
  }, [pendingCount]);

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        // Fires on the first layout and on every message, and again when an
        // image finishes loading and the bubble it sits in grows.
        onContentSizeChange={stickToBottom}
        // The content is unchanged but the window shrank — the keyboard opening
        // under `KeyboardAvoidingView`. Without this the last bubble slides
        // behind the composer at exactly the moment the user is replying to it.
        onLayout={stickToBottom}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const { contentSize, contentOffset, layoutMeasurement } = e.nativeEvent;
          followingRef.current = isNearBottom({
            contentHeight: contentSize.height,
            offsetY: contentOffset.y,
            viewportHeight: layoutMeasurement.height,
          });
        }}
        scrollEventThrottle={16}
      >
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            // Keyed by document id, not by index: an optimistic bubble
            // resolving into a delivered one shifts every later index.
            <View
              key={m.id}
              style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}
            >
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.sender, mine && styles.senderMine]}>
                  {m.senderName}
                </Text>
                {m.text ? (
                  <Text style={[styles.text, mine && styles.textMine]}>
                    {m.text}
                  </Text>
                ) : null}
                {m.attachments.map((a) => (
                  <Attachment
                    key={a.url}
                    a={a}
                    mine={mine}
                    onOpenImage={setViewerUri}
                  />
                ))}
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {timeLabel(m)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Always last: a pending message is by definition the newest. */}
        {pending.map((p) => (
          <PendingBubble
            key={p.id}
            message={p}
            onRetry={onRetry}
            onDiscard={onDiscard}
          />
        ))}
      </ScrollView>

      {viewerUri !== null ? (
        <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: tokens.space.md, gap: tokens.space.sm },
  row: { width: "100%" },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "82%",
    padding: tokens.space.md,
    borderRadius: tokens.radius.md,
    gap: tokens.space.xs,
  },
  mine: { backgroundColor: tokens.colors.primary },
  // White, so the bubble stays distinct from the canvas behind the thread.
  theirs: { backgroundColor: tokens.colors.surface },
  // Greyed while in flight; a failed bubble stays at full strength because it
  // is asking the user to act on it.
  sending: { opacity: 0.6 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: tokens.space.xs,
  },
  actions: { flexDirection: "row", gap: tokens.space.md, paddingTop: 2 },
  action: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.colors.primaryText,
    textDecorationLine: "underline",
  },
  // On-dark variants, following this file's existing convention: the semantic
  // `danger` token is tuned for a white surface and is unreadable on a
  // near-black bubble.
  failed: { fontSize: 12, color: "#FCA5A5" },
  sender: { fontSize: 11, fontWeight: "700", color: tokens.colors.muted },
  senderMine: { color: "rgba(255,255,255,0.7)" },
  text: { fontSize: 15, color: tokens.colors.primary },
  textMine: { color: tokens.colors.primaryText },
  time: { fontSize: 10, color: tokens.colors.muted, alignSelf: "flex-end" },
  timeMine: { color: "rgba(255,255,255,0.6)" },
  thumb: {
    width: 160,
    height: 160,
    borderRadius: tokens.radius.sm,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  pdf: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.sm,
    backgroundColor: "rgba(0,0,0,0.06)",
    padding: tokens.space.sm,
    borderRadius: tokens.radius.sm,
  },
  pdfMine: { backgroundColor: "rgba(255,255,255,0.14)" },
  // Matches the asset's aspect ratio (75.3 × 92.6) so `contain` leaves no padding.
  pdfIcon: { width: 28, height: 34 },
  // `flex: 1` lets the name shrink inside the bubble so `numberOfLines` can
  // actually ellipsize it rather than pushing the row wider.
  pdfName: { fontSize: 13, flex: 1, color: tokens.colors.primary },
  pdfNameMine: { color: tokens.colors.primaryText },
});
