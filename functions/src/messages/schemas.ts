import { z } from "zod";

const attachmentSchema = z.object({
  type: z.enum(["image", "pdf"]),
  url: z.string().min(1),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(10 * 1024 * 1024),
});

export const sendMessageSchema = z
  .object({
    dossierId: z.string().trim().min(1),
    messageId: z.string().trim().min(1),
    text: z.string().max(4096),
    attachments: z.array(attachmentSchema).max(5),
  })
  // Mirror the composer's "nothing to send" guard on the server: a message must
  // carry either non-whitespace text or at least one attachment.
  .refine((v) => v.text.trim().length > 0 || v.attachments.length > 0, {
    message: "Message vide.",
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
