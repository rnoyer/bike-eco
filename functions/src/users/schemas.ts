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

/**
 * Self-service profile edit. Every field is optional because the account screen
 * edits one row at a time — but at least one must be present, or the callable
 * would be a no-op that still fans out over the denormalized copies.
 *
 * The rules mirror `registration/schemas.ts`'s `profile` exactly: a name the
 * user could not have registered with must not be reachable through the edit
 * path either.
 */
export const updateMyProfileSchema = z
  .object({
    nom: z.string().trim().min(1).optional(),
    prenom: z.string().trim().min(1).optional(),
    telephone: z.string().regex(/^\d{10}$/).optional(),
  })
  .refine((v) => v.nom !== undefined || v.prenom !== undefined || v.telephone !== undefined, {
    message: "no field to update",
  });

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
