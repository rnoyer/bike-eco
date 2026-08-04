import { z } from "zod";

export const colleagueAdminSchema = z.object({
  uid: z.string().trim().min(1),
  isAdmin: z.boolean(),
});
export const colleagueActionSchema = z.object({
  uid: z.string().trim().min(1),
});

export type ColleagueAdminInput = z.infer<typeof colleagueAdminSchema>;
export type ColleagueActionInput = z.infer<typeof colleagueActionSchema>;
