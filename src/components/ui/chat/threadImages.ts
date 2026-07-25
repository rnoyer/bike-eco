import type { Message } from "@/lib/firestore/schema";

/** Every image attachment URL across the thread, in message order (PDFs excluded). */
export function threadImageUrls(messages: Message[]): string[] {
  return messages.flatMap((m) =>
    m.attachments.filter((a) => a.type === "image").map((a) => a.url),
  );
}
