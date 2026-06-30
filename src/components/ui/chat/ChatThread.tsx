import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Message, MessageAttachment } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

function timeLabel(m: Message): string {
  return m.createdAt.toDate().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Attachment({ a }: { a: MessageAttachment }) {
  return (
    <View style={styles.attach}>
      <Text style={styles.attachIcon}>{a.type === "pdf" ? "📄" : "🖼️"}</Text>
      <Text style={styles.attachName} numberOfLines={1}>
        {a.name}
      </Text>
    </View>
  );
}

export default function ChatThread({
  messages,
  currentUserId,
}: {
  messages: Message[];
  currentUserId: string;
}) {
  return (
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
                <Attachment key={a.url} a={a} />
              ))}
              <Text style={[styles.time, mine && styles.timeMine]}>
                {timeLabel(m)}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
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
  theirs: { backgroundColor: tokens.colors.divider },
  sender: { fontSize: 11, fontWeight: "700", color: tokens.colors.muted },
  senderMine: { color: "rgba(255,255,255,0.7)" },
  text: { fontSize: 15, color: tokens.colors.primary },
  textMine: { color: tokens.colors.primaryText },
  time: { fontSize: 10, color: tokens.colors.muted, alignSelf: "flex-end" },
  timeMine: { color: "rgba(255,255,255,0.6)" },
  attach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.06)",
    padding: 6,
    borderRadius: tokens.radius.sm,
  },
  attachIcon: { fontSize: 14 },
  attachName: { fontSize: 12, flex: 1 },
});
