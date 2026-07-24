import { z } from "zod";

const attachmentSchema = z.object({
  type: z.enum(["image", "pdf"]),
  url: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
});

export const sendMessageSchema = z.object({
  dossierId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  text: z.string(),
  attachments: z.array(attachmentSchema),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
