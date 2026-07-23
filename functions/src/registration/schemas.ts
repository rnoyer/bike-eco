import { z } from "zod";

const profile = {
  nom: z.string().trim().min(1),
  prenom: z.string().trim().min(1),
  telephone: z.string().regex(/^\d{10}$/),
  departement: z.string().trim().min(1),
  ville: z.string().trim().min(1),
};

// Password mode carries the credentials; Google mode takes identity from auth.
const credential = z.discriminatedUnion("method", [
  z.object({ method: z.literal("password"), email: z.email(), password: z.string().min(8) }),
  z.object({ method: z.literal("google") }),
]);

export const registerCompanySchema = z
  .object({
    siret: z.string().regex(/^\d{14}$/),
    companyName: z.string().trim().min(1),
    ...profile,
  })
  .and(credential);

export const acceptInviteSchema = z
  .object({ code: z.string().trim().min(1), ...profile })
  .and(credential);

export const sendInviteSchema = z.object({ email: z.email() });
export const resolveInviteSchema = z.object({ code: z.string().trim().min(1) });

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type SendInviteInput = z.infer<typeof sendInviteSchema>;
export type ResolveInviteInput = z.infer<typeof resolveInviteSchema>;
