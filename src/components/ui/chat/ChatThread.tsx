import pdfIcon from "@/assets/images/icons/pdfIcon.svg";
import ImageViewerModal from "@/components/ui/ImageViewerModal";
import type { Message, MessageAttachment } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";
import { Image } from "expo-image";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
    Alert.alert("Pièce jointe", "Impossible d'ouvrir le PDF.");
  }
}

/** `mine` bubbles are near-black (`tokens.colors.primary`), so the PDF row has to
 *  flip to light-on-dark or it renders invisible against its own bubble. */
function Attachment({
  a,
  mine,
  onOpenImage,
}: {
  a: MessageAttachment;
  mine: boolean;
  onOpenImage: (url: string) => void;
}) {
  if (a.type === "image") {
    return (
      <Pressable onPress={() => onOpenImage(a.url)}>
        <Image
          source={{ uri: a.url }}
          style={styles.thumb}
          contentFit="cover"
          transition={100}
        />
      </Pressable>
    );
  }
  return (
    <Pressable
      style={[styles.pdf, mine && styles.pdfMine]}
      onPress={() => openPdf(a.url)}
    >
      <Image source={pdfIcon} style={styles.pdfIcon} contentFit="contain" />
      <Text
        style={[styles.pdfName, mine && styles.pdfNameMine]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {a.name}
      </Text>
    </Pressable>
  );
}

export default function ChatThread({
  messages,
  currentUserId,
}: {
  messages: Message[];
  currentUserId: string;
}) {
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m, i) => {
          const mine = m.senderId === currentUserId;
          return (
            <View
              key={`${m.senderId}-${i}`}
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
  theirs: { backgroundColor: tokens.colors.bg },
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
